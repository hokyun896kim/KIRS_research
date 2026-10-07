import { NextRequest, NextResponse } from "next/server";
import { isAllowedPdfUrl } from "@/lib/kirs";
import { metaFrom } from "@/lib/report-input";
import { createBrief, getCachedBrief } from "@/lib/brief-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// 팝업 상단 바이사이드 냉정 브리핑: 저장돼 있으면 즉시, 없으면 생성(1분 안팎) 후 저장
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const url = sp.get("url");
  const no = sp.get("no") ?? "";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (!isAllowedPdfUrl(url)) return NextResponse.json({ error: "domain not allowed" }, { status: 400 });
  if (!/^[0-9A-Za-z-]{1,20}$/.test(no)) return NextResponse.json({ error: "no required" }, { status: 400 });

  const hit = await getCachedBrief(no);
  if (hit) return NextResponse.json({ ...hit, cached: true });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });
  try {
    return NextResponse.json({ ...(await createBrief(no, url, metaFrom((k) => sp.get(k)))), cached: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
