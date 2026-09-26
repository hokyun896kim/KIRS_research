import { NextRequest, NextResponse } from "next/server";
import { extractPdf, detectAuthors, isAllowedPdfUrl } from "@/lib/kirs";
import { matchProfile, counterProfile } from "@/lib/profiles";
import { classifySector } from "@/lib/sector";
import { buildPrompt, buildCounterPrompt } from "@/lib/prompt";
import { getGuideline } from "@/lib/guideline-loader";
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
    const { pages, text } = await extractPdf(url);
    const { analyst, ra } = detectAuthors(text);
    const profile = matchProfile(analyst ?? report.author);
    const raProfile = ra ? matchProfile(ra) : undefined;
    const sector = classifySector(report.name, report.title);
    const guideline = getGuideline();

    const base = { guideline, report, analyst, ra, profile, raProfile, pdfText: text, sector: sector.label };
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
