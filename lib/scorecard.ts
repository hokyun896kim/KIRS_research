import "server-only";
import { unstable_cache } from "next/cache";
import { getReportIndex } from "./history";
import { matchProfile } from "./profiles";

// 애널 적중률 성적표: 리포트 발간일 종가 → N거래일 뒤 수익률, 소속 시장 지수 대비 초과수익률.
// 주가: 네이버 금융 일봉(수정주가). 배당 미포함.

export const HORIZONS = [
  { key: "1M", days: 21 },
  { key: "3M", days: 63 },
  { key: "6M", days: 126 },
  { key: "12M", days: 252 },
] as const;
export type HorizonKey = (typeof HORIZONS)[number]["key"];

type Bar = { d: string; c: number }; // d: YYYYMMDD
type Market = "KOSPI" | "KOSDAQ";

export type ScoredReport = {
  no: string | null;
  name: string;
  code: string;
  title: string;
  author: string;
  date: string;
  market: Market;
  ret: Partial<Record<HorizonKey, number>>; // 절대 수익률
  excess: Partial<Record<HorizonKey, number>>; // 시장 대비 초과
};

export type HorizonStat = { n: number; avgExcess: number; medianExcess: number; winRate: number; avgRet: number };

export type AnalystScore = {
  author: string;
  type: string | null; // 프로파일 유형 (미등록이면 null)
  stance: string | null;
  reports: number;
  stats: Partial<Record<HorizonKey, HorizonStat>>;
};

export type Scorecard = {
  generatedAt: string;
  coverage: { reports: number; scored: number; skipped: number };
  analysts: AnalystScore[];
  rows: ScoredReport[];
};

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };

async function fetchBars(symbol: string, count = 1500): Promise<Bar[]> {
  const res = await fetch(
    `https://fchart.stock.naver.com/sise.nhn?symbol=${encodeURIComponent(symbol)}&timeframe=day&count=${count}&requestType=0`,
    { headers: UA, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`chart HTTP ${res.status} for ${symbol}`);
  const xml = await res.text();
  const bars: Bar[] = [];
  for (const m of xml.matchAll(/<item data="(\d{8})\|[^|]*\|[^|]*\|[^|]*\|([\d.]+)\|/g)) {
    const c = Number(m[2]);
    if (c > 0) bars.push({ d: m[1], c });
  }
  return bars;
}

async function fetchMarket(code: string): Promise<Market | null> {
  const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, { headers: UA, cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json().catch(() => null)) as { stockExchangeType?: { code?: string } } | null;
  const t = j?.stockExchangeType?.code;
  return t === "KS" ? "KOSPI" : t === "KQ" ? "KOSDAQ" : null;
}

// 발간일(YYYY-MM-DD) 이후 첫 거래일 인덱스
function startIndex(bars: Bar[], date: string): number {
  const d = date.replaceAll("-", "");
  let lo = 0, hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].d < d) lo = mid + 1;
    else hi = mid;
  }
  return lo < bars.length ? lo : -1;
}

function closeOnOrAfter(bars: Bar[], d: string): number | null {
  const i = startIndex(bars, `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`);
  return i >= 0 ? bars[i].c : null;
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function buildScorecard(): Promise<Scorecard> {
  const reports = (await getReportIndex()).filter((r) => r.code && /^\d{6}$|^[0-9A-Z]{6}$/.test(r.code));
  const [kospi, kosdaq] = await Promise.all([fetchBars("KOSPI"), fetchBars("KOSDAQ")]);
  const bench: Record<Market, Bar[]> = { KOSPI: kospi, KOSDAQ: kosdaq };

  const codes = [...new Set(reports.map((r) => r.code!))];
  const perCode = new Map<string, { bars: Bar[]; market: Market } | null>();
  await pool(codes, 8, async (code) => {
    try {
      const [bars, market] = await Promise.all([fetchBars(code), fetchMarket(code)]);
      perCode.set(code, bars.length ? { bars, market: market ?? "KOSDAQ" } : null);
    } catch {
      perCode.set(code, null);
    }
  });

  const rows: ScoredReport[] = [];
  let skipped = 0;
  for (const r of reports) {
    const data = perCode.get(r.code!);
    const i = data ? startIndex(data.bars, r.date) : -1;
    if (!data || i < 0) {
      skipped++;
      continue;
    }
    const base = data.bars[i];
    const b0 = closeOnOrAfter(bench[data.market], base.d);
    const ret: ScoredReport["ret"] = {};
    const excess: ScoredReport["excess"] = {};
    for (const h of HORIZONS) {
      const end = data.bars[i + h.days];
      if (!end) continue;
      ret[h.key] = end.c / base.c - 1;
      const b1 = closeOnOrAfter(bench[data.market], end.d);
      if (b0 && b1) excess[h.key] = ret[h.key]! - (b1 / b0 - 1);
    }
    rows.push({ no: r.no, name: r.name, code: r.code!, title: r.title, author: r.author, date: r.date, market: data.market, ret, excess });
  }

  const byAuthor = new Map<string, ScoredReport[]>();
  for (const row of rows) byAuthor.set(row.author, [...(byAuthor.get(row.author) ?? []), row]);
  const analysts: AnalystScore[] = [...byAuthor.entries()].map(([author, list]) => {
    const p = matchProfile(author);
    const stats: AnalystScore["stats"] = {};
    for (const h of HORIZONS) {
      const ex = list.map((x) => x.excess[h.key]).filter((v): v is number => v != null);
      const rt = list.map((x) => x.ret[h.key]).filter((v): v is number => v != null);
      if (!ex.length) continue;
      stats[h.key] = {
        n: ex.length,
        avgExcess: ex.reduce((a, b) => a + b, 0) / ex.length,
        medianExcess: median(ex),
        winRate: ex.filter((v) => v > 0).length / ex.length,
        avgRet: rt.reduce((a, b) => a + b, 0) / rt.length,
      };
    }
    return { author, type: p?.type ?? null, stance: p?.stance ?? null, reports: list.length, stats };
  });
  analysts.sort((a, b) => b.reports - a.reports);

  return {
    generatedAt: new Date().toISOString(),
    coverage: { reports: reports.length, scored: rows.length, skipped },
    analysts,
    rows: rows.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

// 전체 계산(종목 수백 개 × 일봉)은 10초 안팎 → 24시간 캐시 (vercel.json 크론이 매일 아침 미리 데워 둠)
export const getScorecard = unstable_cache(buildScorecard, ["kirs-scorecard-v1"], {
  revalidate: 24 * 3600,
  tags: ["kirs-scorecard"],
});
