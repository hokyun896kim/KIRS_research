import { NextRequest, NextResponse } from "next/server";
import { extractPdf, detectAuthors, isAllowedPdfUrl } from "@/lib/kirs";
import { matchProfile, counterProfile } from "@/lib/profiles";
import { classifySector } from "@/lib/sector";
import { buildPrompt, buildCounterPrompt } from "@/lib/prompt";
import { getGuideline } from "@/lib/guideline-loader";
import { getAnalysisContext } from "@/lib/analysis-context";
import type { ExtractResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const url = sp.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (!isAllowedPdfUrl(url)) return NextResponse.json({ error: "domain not allowed" }, { status: 400 });

  const report = {
    name: sp.get("name") ?? "",
    code: sp.get("code") || null,
    title: sp.get("title") ?? "",
    date: sp.get("date") ?? "",
    author: sp.get("author") ?? "",
  };

  try {
    // 복붙 프롬프트에도 성적·이력을 넣되, 캐시가 식어 느리면 빼고 바로 응답. PDF 파싱보다 먼저 (analysis-context.ts)
    const context = await getAnalysisContext(report, 4000);
    const { pages, text } = await extractPdf(url);
    const { analyst, ra } = detectAuthors(text);
    const profile = matchProfile(analyst ?? report.author);
    const raProfile = ra ? matchProfile(ra) : undefined;
    const sector = classifySector(report.name, report.title);
    const guideline = getGuideline();

    const base = { guideline, report, analyst, ra, profile, raProfile, pdfText: text, sector: sector.label, context };
    const counterLens =
      matchProfile(sp.get("lens")) ?? counterProfile(profile, [analyst, ra].filter((x): x is string => !!x));
    const body: ExtractResponse = {
      pages,
      textLength: text.length,
      analyst,
      ra,
      profile: profile ?? null,
      raProfile: raProfile ?? null,
      sector: { label: sector.label, color: sector.color },
      promptFull: buildPrompt({ ...base, mode: "full" }),
      promptTrade: buildPrompt({ ...base, mode: "trade" }),
      counterLens,
      promptCounter: buildCounterPrompt({ ...base, lens: counterLens }),
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
