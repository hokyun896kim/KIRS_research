import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractPdf, detectAuthors, isAllowedPdfUrl } from "@/lib/kirs";
import { matchProfile } from "@/lib/profiles";
import { classifySector } from "@/lib/sector";
import { buildPrompt } from "@/lib/prompt";
import { getGuideline } from "@/lib/guideline-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";

type Body = {
  url?: string;
  name?: string;
  code?: string | null;
  title?: string;
  date?: string;
  author?: string;
  mode?: "full" | "trade";
};

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (!isAllowedPdfUrl(b.url)) return NextResponse.json({ error: "domain not allowed" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });

  const mode = b.mode === "trade" ? "trade" : "full";
  const report = {
    name: b.name ?? "",
    code: b.code || null,
    title: b.title ?? "",
    date: b.date ?? "",
    author: b.author ?? "",
  };

  let prompt: string;
  try {
    const { text } = await extractPdf(b.url);
    const { analyst, ra } = detectAuthors(text);
    prompt = buildPrompt({
      guideline: getGuideline(),
      report,
      analyst,
      ra,
      profile: matchProfile(analyst ?? report.author),
      raProfile: ra ? matchProfile(ra) : undefined,
      pdfText: text,
      mode,
      sector: classifySector(report.name, report.title).label,
    });
  } catch (e) {
    return NextResponse.json({ error: "extract failed", message: (e as Error).message }, { status: 502 });
  }

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
    // 매매모드: 현재가·52주 고저·밸류를 최신 웹검색으로 보강
    ...(mode === "trade" ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 5 }] } : {}),
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n> ⚠ 분석 중 오류: ${(e as Error).message}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Analyze-Model": MODEL,
    },
  });
}
