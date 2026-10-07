import { NextRequest, NextResponse } from "next/server";
import { isAllowedPdfUrl } from "@/lib/kirs";
import { loadReport, metaFrom } from "@/lib/report-input";
import { buildBriefPrompt, generateBrief, BRIEF_MODEL, type Brief } from "@/lib/brief";
import { blobEnabled, putJson, readJson, saveVerdict } from "@/lib/verdicts";
import { getScorecard } from "@/lib/scorecard";
import { findSameCompany } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Cached = { brief: Brief; createdAt: string; model: string };

const pct = (v?: number) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

// 성적표·이력은 판단 보조 자료라 실패해도 브리핑은 만든다
async function context(author: string, code: string | null, name: string, no: string) {
  const [sc, hist] = await Promise.all([getScorecard().catch(() => null), findSameCompany(code, name).catch(() => null)]);
  const a = sc?.analysts.find((x) => x.author === author);
  const track = a
    ? (["3M", "6M", "12M"] as const)
        .map((h) => a.stats[h] && `${h} 평균 ${pct(a.stats[h]!.avgExcess)} · 중앙값 ${pct(a.stats[h]!.medianExcess)} · 승률 ${(a.stats[h]!.winRate * 100).toFixed(0)}% (n=${a.stats[h]!.n})`)
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

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const url = sp.get("url");
  const no = sp.get("no") ?? "";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (!isAllowedPdfUrl(url)) return NextResponse.json({ error: "domain not allowed" }, { status: 400 });
  if (!/^[0-9A-Za-z-]{1,20}$/.test(no)) return NextResponse.json({ error: "no required" }, { status: 400 });

  const path = `briefs/v1/${no}.json`;
  if (blobEnabled()) {
    const hit = await readJson<Cached>(path);
    if (hit) return NextResponse.json({ ...hit, cached: true });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });

  const report = metaFrom((k) => sp.get(k));
  try {
    const [L, ctx] = await Promise.all([loadReport(url, report), context(report.author, report.code, report.name, no)]);
    const d = report.date.match(/(\d{4})-(\d{2})-(\d{2})/);
    const daysSince = d ? Math.floor((Date.now() - new Date(+d[1], +d[2] - 1, +d[3]).getTime()) / 86400000) : null;
    const brief = await generateBrief(
      buildBriefPrompt({ report, analyst: L.analyst, ra: L.ra, profile: L.profile, pdfText: L.text, daysSince, ...ctx })
    );
    const out: Cached = { brief, createdAt: new Date().toISOString(), model: BRIEF_MODEL };
    if (blobEnabled()) {
      await Promise.all([
        putJson(path, out).catch(() => {}),
        // 브리핑 판정도 "AI 판정 검증"에 쌓는다 (풀·매매모드 판정이 있으면 그쪽이 우선)
        saveVerdict(
          { no, mode: "brief", verdict: brief.verdict, conviction: brief.conviction, relative: null, baseUpside: null, createdAt: out.createdAt },
          { name: report.name, code: report.code, date: report.date, author: report.author, model: BRIEF_MODEL, positiveOdds: brief.positiveOdds }
        ).catch(() => {}),
      ]);
    }
    return NextResponse.json({ ...out, cached: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
