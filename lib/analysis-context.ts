import "server-only";
import { getContextSnapshot, type ContextSnapshot } from "./context-snapshot";

// 분석·브리핑 프롬프트에 붙이는 보조 자료: 오늘 날짜, 작성 애널의 과거 성적, 이 종목 KIRS 이력.
// 성적·이력은 "그 리포트 발간일에 알 수 있었던 것"만 쓴다 — 과거 리포트를 판정할 때 미래 결과가 새지 않게.
export type AnalysisContext = {
  today: string; // YYYY-MM-DD (KST)
  trackRecord: string | null; // "" = 결과가 확정된 리포트가 적어 보정 생략, null = 조회 실패
  history: string[] | null; // 이전 리포트 (최신순), null이면 조회 실패
};

const pct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// 성적표 기간(거래일)을 넉넉한 달력일로 — 발간일 기준 이 기간이 지난 리포트만 "결과가 확정된" 것으로 본다.
// 값은 스냅샷 track 행의 열 번호 (2=3M, 3=6M, 4=12M)
const HORIZONS = [
  { key: "3M", col: 2, days: 95 },
  { key: "6M", col: 3, days: 185 },
  { key: "12M", col: 4, days: 370 },
] as const;
const MIN_N = 3;

export function todayKST(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

const dayNum = (d: string) => {
  const m = d.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400_000 : NaN;
};

function trackRecordOf(snap: ContextSnapshot, author: string, asOf: string): string {
  const cutoff = dayNum(asOf);
  const mine = snap.track.filter((r) => r[0] === author);
  const parts: string[] = [];
  for (const h of HORIZONS) {
    const ex = mine
      .filter((r) => dayNum(r[1]) + h.days <= cutoff)
      .map((r) => r[h.col])
      .filter((v): v is number => v != null);
    if (ex.length < MIN_N) continue;
    const avg = ex.reduce((a, b) => a + b, 0) / ex.length;
    const win = ex.filter((v) => v > 0).length / ex.length;
    parts.push(`${h.key} 평균 ${pct(avg)} · 중앙값 ${pct(median(ex))} · 승률 ${(win * 100).toFixed(0)}% (n=${ex.length})`);
  }
  return parts.join(" / ");
}

function historyOf(snap: ContextSnapshot, code: string | null, name: string, date: string, title: string): string[] {
  const seen = new Set<string>();
  return snap.index
    .filter(([c, n]) => (code ? c === code : n === name))
    .filter(([, , d, , t]) => d < date || (d === date && t !== title))
    .filter(([, , d, , t]) => !seen.has(d + t) && !!seen.add(d + t))
    .sort((a, b) => b[2].localeCompare(a[2]))
    .slice(0, 5)
    .map(([, , d, a, t]) => `${d} · ${a} · "${t}"`);
}

// 스냅샷(Blob)을 못 읽으면 성적·이력은 빼고 진행한다
export async function getAnalysisContext(
  r: { author: string; code: string | null; name: string; date: string; title: string },
  timeoutMs = 5000
): Promise<AnalysisContext> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const snap = await Promise.race([
    getContextSnapshot().catch(() => null),
    new Promise<null>((res) => (timer = setTimeout(() => res(null), timeoutMs))),
  ]).finally(() => clearTimeout(timer));
  if (!snap) console.warn("[analysis-context] snapshot unavailable");
  return {
    today: todayKST(),
    trackRecord: snap ? trackRecordOf(snap, r.author, r.date) : null,
    history: snap ? historyOf(snap, r.code, r.name, r.date, r.title) : null,
  };
}
