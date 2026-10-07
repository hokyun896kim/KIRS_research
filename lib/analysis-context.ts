import "server-only";
import { getScorecard, type HorizonKey } from "./scorecard";
import { findSameCompany } from "./history";

// 분석·브리핑 프롬프트에 붙이는 보조 자료: 오늘 날짜, 작성 애널의 과거 성적, 이 종목 KIRS 이력.
// 성적·이력은 "그 리포트 발간일에 알 수 있었던 것"만 쓴다 — 과거 리포트를 판정할 때 미래 결과가 새지 않게.
export type AnalysisContext = {
  today: string; // YYYY-MM-DD (KST)
  trackRecord: string | null;
  history: string[] | null; // 이전 리포트 (최신순), null이면 조회 실패
};

const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// 성적표 기간(거래일)을 넉넉한 달력일로 — 발간일 기준 이 기간이 지난 리포트만 "결과가 확정된" 것으로 본다
const HORIZON_DAYS: [HorizonKey, number][] = [
  ["3M", 95],
  ["6M", 185],
  ["12M", 370],
];
const MIN_N = 3;

export function todayKST(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

const dayNum = (d: string) => {
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400_000 : NaN;
};

function withTimeout<T>(label: string, p: Promise<T>, ms: number): Promise<T | null> {
  const t0 = Date.now();
  return Promise.race([
    p.catch((e) => {
      console.warn(`[analysis-context] ${label} failed after ${Date.now() - t0}ms: ${(e as Error).message}`);
      return null;
    }),
    new Promise<null>((r) =>
      setTimeout(() => {
        console.warn(`[analysis-context] ${label} timed out after ${ms}ms`);
        r(null);
      }, ms)
    ),
  ]);
}

async function trackRecordOf(author: string, asOf: string): Promise<string | null> {
  const sc = await getScorecard();
  const cutoff = dayNum(asOf);
  const mine = sc.rows.filter((r) => r.author === author);
  const parts: string[] = [];
  for (const [h, days] of HORIZON_DAYS) {
    const ex = mine
      .filter((r) => dayNum(r.date) + days <= cutoff)
      .map((r) => r.excess[h])
      .filter((v): v is number => v != null);
    if (ex.length < MIN_N) continue;
    const avg = ex.reduce((a, b) => a + b, 0) / ex.length;
    const win = ex.filter((v) => v > 0).length / ex.length;
    parts.push(`${h} 평균 ${pct(avg)} · 중앙값 ${pct(median(ex))} · 승률 ${(win * 100).toFixed(0)}% (n=${ex.length})`);
  }
  return parts.length ? parts.join(" / ") : null;
}

async function historyOf(code: string | null, name: string, date: string, title: string): Promise<string[]> {
  const all = await findSameCompany(code, name);
  return all
    .filter((r) => r.date < date || (r.date === date && r.title !== title))
    .slice(0, 5)
    .map((r) => `${r.date} · ${r.author} · "${r.title}"`);
}

// 실패하거나 느리면(캐시가 식은 경우) 해당 항목만 빼고 진행한다
export async function getAnalysisContext(
  r: { author: string; code: string | null; name: string; date: string; title: string },
  timeoutMs = 8000
): Promise<AnalysisContext> {
  const [trackRecord, history] = await Promise.all([
    withTimeout("trackRecord", trackRecordOf(r.author, r.date), timeoutMs),
    withTimeout("history", historyOf(r.code, r.name, r.date, r.title), timeoutMs),
  ]);
  return { today: todayKST(), trackRecord, history };
}
