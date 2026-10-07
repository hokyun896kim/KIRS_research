import "server-only";
import { loadReport, type ReportMeta } from "./report-input";
import { buildBriefPrompt, generateBrief, BRIEF_MODEL, type Brief } from "./brief";
import { blobEnabled, putJson, readJson, saveVerdict } from "./verdicts";
import { getScorecard } from "./scorecard";
import { findSameCompany } from "./history";

export type CachedBrief = { brief: Brief; createdAt: string; model: string };

const pathOf = (no: string) => `briefs/v1/${no}.json`;
const pct = (v?: number) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

export const getCachedBrief = (no: string) => (blobEnabled() ? readJson<CachedBrief>(pathOf(no)) : Promise.resolve(null));

// 성적표·이력은 판단 보조 자료라 실패해도 브리핑은 만든다
async function context(author: string, code: string | null, name: string, no: string) {
  const [sc, hist] = await Promise.all([getScorecard().catch(() => null), findSameCompany(code, name).catch(() => null)]);
  const a = sc?.analysts.find((x) => x.author === author);
  const track = a
    ? (["3M", "6M", "12M"] as const)
        .map((h) => {
          const s = a.stats[h];
          return s && `${h} 평균 ${pct(s.avgExcess)} · 중앙값 ${pct(s.medianExcess)} · 승률 ${(s.winRate * 100).toFixed(0)}% (n=${s.n})`;
        })
        .filter(Boolean)
        .join(" / ")
    : null;
  const prior = (hist ?? []).filter((r) => r.no !== no);
  const history = hist
    ? prior.length
      ? `이전 ${prior.length}건 (직전 ${prior[0].date} ${prior[0].author} "${prior[0].title}")`
      : "이번이 첫 리포트"
    : null;
  return { trackRecord: track || null, history };
}

// 브리핑을 새로 만들어 저장한다 (판정은 "AI 판정 검증"에도 brief 모드로 쌓음)
export async function createBrief(no: string, url: string, report: ReportMeta): Promise<CachedBrief> {
  const [L, ctx] = await Promise.all([loadReport(url, report), context(report.author, report.code, report.name, no)]);
  const d = report.date.match(/(\d{4})-(\d{2})-(\d{2})/);
  const daysSince = d ? Math.floor((Date.now() - new Date(+d[1], +d[2] - 1, +d[3]).getTime()) / 86400000) : null;
  const brief = await generateBrief(
    buildBriefPrompt({ report, analyst: L.analyst, ra: L.ra, profile: L.profile, pdfText: L.text, daysSince, ...ctx })
  );
  const out: CachedBrief = { brief, createdAt: new Date().toISOString(), model: BRIEF_MODEL };
  if (blobEnabled()) {
    await Promise.all([
      putJson(pathOf(no), out).catch(() => {}),
      saveVerdict(
        { no, mode: "brief", verdict: brief.verdict, conviction: brief.conviction, relative: null, baseUpside: null, createdAt: out.createdAt },
        { name: report.name, code: report.code, date: report.date, author: report.author, model: BRIEF_MODEL, positiveOdds: brief.positiveOdds }
      ).catch(() => {}),
    ]);
  }
  return out;
}
