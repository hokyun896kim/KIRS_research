import "server-only";
import { unstable_cache } from "next/cache";
import { getScorecard, HORIZONS, type HorizonKey, type ScoredReport } from "./scorecard";
import { blobEnabled, listBatches, listVerdicts, type Verdict } from "./verdicts";
import { FAIR_SINCE } from "./backfill";

export type Group = { label: string; n: number; avgExcess: number | null; medianExcess: number | null; winRate: number | null };
export type HorizonGroups = { overall: Group; byVerdict: Group[]; byConviction: Group[]; byUpside: Group[] };
export type VerdictStats = {
  enabled: boolean;
  fairSince: string;
  includeAll: boolean;
  verdictCount: number;
  byMode: Record<string, number>;
  pendingBatches: number;
  pendingReports: number;
  matched: number;
  horizons: Partial<Record<HorizonKey, HorizonGroups>>;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function group(label: string, xs: number[]): Group {
  if (!xs.length) return { label, n: 0, avgExcess: null, medianExcess: null, winRate: null };
  return {
    label,
    n: xs.length,
    avgExcess: xs.reduce((a, b) => a + b, 0) / xs.length,
    medianExcess: median(xs),
    winRate: xs.filter((v) => v > 0).length / xs.length,
  };
}

// 리포트당 판정 하나: 풀·매매모드(최신) > 팝업 브리핑 > 일괄 판정
function pickPerReport(vs: Verdict[]): Map<string, Verdict> {
  const rank = (v: Verdict) => (v.mode === "backfill" ? 0 : v.mode === "brief" ? 1 : 2);
  const out = new Map<string, Verdict>();
  for (const v of vs) {
    const cur = out.get(v.no);
    if (!cur || rank(v) > rank(cur) || (rank(v) === rank(cur) && v.createdAt > cur.createdAt)) out.set(v.no, v);
  }
  return out;
}

const convBucket = (c: number | null) => (c == null ? null : c <= 2.5 ? "확신도 ≤2.5" : c < 4 ? "확신도 3~3.5" : "확신도 ≥4");
const upBucket = (u: number | null) =>
  u == null ? "근거 없음" : u < 0 ? "업사이드 < 0%" : u < 0.3 ? "0~30%" : u < 0.6 ? "30~60%" : "≥ 60%";

async function build(includeAll: boolean): Promise<VerdictStats> {
  const enabled = blobEnabled();
  const [vs, batches, sc] = await Promise.all([listVerdicts(), listBatches(), getScorecard()]);
  const byMode: Record<string, number> = {};
  for (const v of vs) byMode[v.mode] = (byMode[v.mode] ?? 0) + 1;

  const picked = pickPerReport(vs);
  const rows = sc.rows.filter((r) => r.no && picked.has(r.no) && (includeAll || r.date >= FAIR_SINCE));
  const horizons: VerdictStats["horizons"] = {};
  for (const h of HORIZONS) {
    const withEx = rows.filter((r) => r.excess[h.key] != null);
    if (!withEx.length) continue;
    const ex = (pred: (v: Verdict, r: ScoredReport) => boolean) =>
      withEx.filter((r) => pred(picked.get(r.no!)!, r)).map((r) => r.excess[h.key]!);
    horizons[h.key] = {
      overall: group("판정된 리포트 전체", ex(() => true)),
      byVerdict: (["필독", "참고", "패스"] as const).map((l) => group(l, ex((v) => v.verdict === l))),
      byConviction: ["확신도 ≥4", "확신도 3~3.5", "확신도 ≤2.5"].map((l) => group(l, ex((v) => convBucket(v.conviction) === l))),
      byUpside: ["≥ 60%", "30~60%", "0~30%", "업사이드 < 0%", "근거 없음"].map((l) => group(l, ex((v) => upBucket(v.baseUpside) === l))),
    };
  }
  return {
    enabled,
    fairSince: FAIR_SINCE,
    includeAll,
    verdictCount: vs.length,
    byMode,
    pendingBatches: batches.length,
    pendingReports: batches.reduce((a, b) => a + b.ids.length, 0),
    matched: rows.length,
    horizons,
  };
}

// Blob 목록 조회를 아끼려고 10분 캐시
export const getVerdictStats = unstable_cache(build, ["kirs-verdict-stats-v1"], { revalidate: 600 });
