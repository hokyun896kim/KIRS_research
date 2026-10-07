import { NextRequest, NextResponse } from "next/server";
import { isAllowedPdfUrl } from "@/lib/kirs";
import { metaFrom } from "@/lib/report-input";
import { createBrief, getCachedBrief } from "@/lib/brief-service";
import { getCohort, tierOf } from "@/lib/score-tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 팝업 상단 바이사이드 냉정 브리핑: 저장돼 있으면 즉시, 없으면 생성(30초 안팎) 후 저장
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const url = sp.get("url");
  const no = sp.get("no") ?? "";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (!isAllowedPdfUrl(url)) return NextResponse.json({ error: "domain not allowed" }, { status: 400 });
  if (!/^[0-9A-Za-z-]{1,20}$/.test(no)) return NextResponse.json({ error: "no required" }, { status: 400 });

  // tier = 화면에 보이는 필독·참고·패스 (긍정 가능성의 상대 순위, lib/score-tiers.ts)
  const [hit, cohort] = await Promise.all([getCachedBrief(no), getCohort()]);
  if (hit) return NextResponse.json({ ...hit, tier: tierOf(hit.brief.positiveOdds, cohort), cached: true });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });
  try {
    const made = await createBrief(no, url, metaFrom((k) => sp.get(k)));
    return NextResponse.json({ ...made, tier: tierOf(made.brief.positiveOdds, cohort), cached: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
