import "server-only";
import { listVerdicts, type Verdict, type VerdictLabel } from "./verdicts";
import { getCachedBrief } from "./brief-service";

// 필독·참고·패스를 모델 라벨 대신 긍정 가능성 점수(0~100)의 상대 순위로 정한다.
// 모델은 리포트를 한 건씩 따로 보기 때문에 "상위 20%"를 스스로 지키지 못했다 (2026-10 일괄 판정: 참고 50/54 → 기준을 바꾸자 패스 37/54).
// 상위 20% = 필독, 하위 20% = 패스, 나머지 = 참고. 점수가 모자라면(20건 미만) 고정 기준으로 나눈다.
const TOP = 0.8;
const BOTTOM = 0.2;
const MIN_COHORT = 20;
const FALLBACK = { hi: 60, lo: 35 };
const MEMO_MS = 10 * 60_000;

// 리포트별 점수: 브리핑(팝업) 점수가 있으면 우선, 없으면 일괄 판정 점수
export async function getReportScores(vs?: Verdict[]): Promise<Map<string, number>> {
  const all = vs ?? (await listVerdicts());
  const brief = new Map<string, Verdict>();
  const backfill = new Map<string, Verdict>();
  for (const v of all) {
    const m = v.mode === "brief" ? brief : v.mode === "backfill" ? backfill : null;
    if (!m) continue;
    const cur = m.get(v.no);
    if (!cur || v.createdAt > cur.createdAt) m.set(v.no, v);
  }
  const out = new Map<string, number>();
  for (const [no, v] of backfill) if (v.score != null) out.set(no, v.score);
  // 2026-10 이전 브리핑 판정은 경로에 점수가 없어 저장된 브리핑에서 읽는다
  await Promise.all(
    [...brief.values()].map(async (v) => {
      const s = v.score ?? (await getCachedBrief(v.no).catch(() => null))?.brief.positiveOdds;
      if (s != null) out.set(v.no, s);
    })
  );
  return out;
}

export type Cohort = { sorted: number[] };
let memo: { at: number; cohort: Cohort } | null = null;

export async function getCohort(): Promise<Cohort> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.cohort;
  const scores = await getReportScores().catch(() => new Map<string, number>());
  const cohort = { sorted: [...scores.values()].sort((a, b) => a - b) };
  memo = { at: Date.now(), cohort };
  return cohort;
}

// 같은 점수가 많아도 한쪽으로 몰리지 않게 중간 순위(midrank)로 백분위를 잡는다
export function tierOf(score: number, cohort: Cohort): VerdictLabel {
  const s = cohort.sorted;
  if (s.length < MIN_COHORT) return score >= FALLBACK.hi ? "필독" : score <= FALLBACK.lo ? "패스" : "참고";
  let below = 0;
  let equal = 0;
  for (const x of s) {
    if (x < score) below++;
    else if (x === score) equal++;
  }
  const pct = (below + equal / 2) / s.length;
  return pct >= TOP ? "필독" : pct < BOTTOM ? "패스" : "참고";
}
