import "server-only";
import { loadReport, type ReportMeta } from "./report-input";
import { buildBriefPrompt, generateBrief, BRIEF_MODEL, type Brief } from "./brief";
import { blobEnabled, putJson, readJson, saveVerdict } from "./verdicts";
import { getAnalysisContext } from "./analysis-context";

export type CachedBrief = { brief: Brief; createdAt: string; model: string };

const pathOf = (no: string) => `briefs/v1/${no}.json`;

export const getCachedBrief = (no: string) => (blobEnabled() ? readJson<CachedBrief>(pathOf(no)) : Promise.resolve(null));

// 성적표·이력은 판단 보조 자료라 실패해도 브리핑은 만든다 (발간일에 알 수 있었던 것만)
async function context(report: ReportMeta) {
  const c = await getAnalysisContext(report);
  const history =
    c.history == null ? null : c.history.length ? `이전 ${c.history.length}건 — ${c.history.join(" / ")}` : "이번이 첫 리포트";
  return { trackRecord: c.trackRecord, history, today: c.today };
}

// 브리핑을 새로 만들어 저장한다 (판정은 "AI 판정 검증"에도 brief 모드로 쌓음)
export async function createBrief(no: string, url: string, report: ReportMeta): Promise<CachedBrief> {
  const ctx = await context(report); // PDF 파싱보다 먼저 (analysis-context.ts)
  const L = await loadReport(url, report);
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
        { no, mode: "brief", verdict: brief.verdict, conviction: brief.conviction, relative: null, baseUpside: null, score: brief.positiveOdds, createdAt: out.createdAt },
        { name: report.name, code: report.code, date: report.date, author: report.author, model: BRIEF_MODEL, positiveOdds: brief.positiveOdds }
      ).catch(() => {}),
    ]);
  }
  return out;
}
