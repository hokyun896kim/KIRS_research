import { NextRequest, NextResponse } from "next/server";
import { isAllowedPdfUrl } from "@/lib/kirs";
import { buildComparePrompt } from "@/lib/prompt";
import { loadReport, metaFrom } from "@/lib/report-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 비교모드 복사용 프롬프트 (두 리포트 본문 텍스트 포함). ?url=…&name=… + prevUrl=…&prevName=…
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const url = sp.get("url");
  const prevUrl = sp.get("prevUrl");
  if (!url || !prevUrl) return NextResponse.json({ error: "url and prevUrl required" }, { status: 400 });
  if (!isAllowedPdfUrl(url) || !isAllowedPdfUrl(prevUrl))
    return NextResponse.json({ error: "domain not allowed" }, { status: 400 });

  const prefixed = (k: string) => sp.get(`prev${k[0].toUpperCase()}${k.slice(1)}`);
  try {
    const [cur, prev] = await Promise.all([
      loadReport(url, metaFrom((k) => sp.get(k))),
      loadReport(prevUrl, metaFrom(prefixed)),
    ]);
    const side = (r: typeof cur) => ({ report: r.report, analyst: r.analyst, profile: r.profile, pdfText: r.text });
    return NextResponse.json({ promptCompare: buildComparePrompt({ current: side(cur), previous: side(prev) }) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
