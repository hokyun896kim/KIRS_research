import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchPdf, extractPdfText, detectAuthors, isAllowedPdfUrl } from "@/lib/kirs";
import { matchProfile, counterProfile } from "@/lib/profiles";
import { classifySector } from "@/lib/sector";
import { buildPrompt, buildCounterPrompt } from "@/lib/prompt";
import { getGuideline } from "@/lib/guideline-loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";
// PDF 원본을 그대로 보내면 표·차트까지 읽는다. 요청 한도(32MB) 안쪽만 첨부하고, 넘으면 추출 텍스트로 대체.
const MAX_PDF_BYTES = 20 * 1024 * 1024;
// maxDuration(300초) 전에 스스로 끊어서 504 대신 "여기까지 분석" 안내를 남긴다.
const SOFT_DEADLINE_MS = 280_000;

type Body = {
  url?: string;
  name?: string;
  code?: string | null;
  title?: string;
  date?: string;
  author?: string;
  mode?: "full" | "trade" | "counter";
  lens?: string; // 반론모드 렌즈 애널 이름
};

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (!isAllowedPdfUrl(b.url)) return NextResponse.json({ error: "domain not allowed" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });

  const mode = b.mode === "trade" || b.mode === "counter" ? b.mode : "full";
  const report = {
    name: b.name ?? "",
    code: b.code || null,
    title: b.title ?? "",
    date: b.date ?? "",
    author: b.author ?? "",
  };

  let prompt: string;
  let pdfBase64: string | null = null;
  try {
    const buf = await fetchPdf(b.url);
    if (buf.length <= MAX_PDF_BYTES) pdfBase64 = buf.toString("base64");
    const { text } = await extractPdfText(buf);
    const { analyst, ra } = detectAuthors(text);
    const profile = matchProfile(analyst ?? report.author);
    const base = {
      guideline: getGuideline(),
      report,
      analyst,
      ra,
      profile,
      raProfile: ra ? matchProfile(ra) : undefined,
      pdfText: text,
      sector: classifySector(report.name, report.title).label,
      attachedPdf: pdfBase64 != null,
    };
    prompt =
      mode === "counter"
        ? buildCounterPrompt({
            ...base,
            lens: matchProfile(b.lens) ?? counterProfile(profile, [analyst, ra].filter((x): x is string => !!x)),
          })
        : buildPrompt({ ...base, mode });
  } catch (e) {
    return NextResponse.json({ error: "extract failed", message: (e as Error).message }, { status: 502 });
  }

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    // 적응형 사고는 끈다: PDF 원본 + 긴 지시에서 사고만으로 Hobby 함수 한도(300초)를 넘겨 첫 글자도 못 내보냈다.
    messages: [
      {
        role: "user",
        content: [
          ...(pdfBase64
            ? [
                {
                  type: "document" as const,
                  source: { type: "base64" as const, media_type: "application/pdf" as const, data: pdfBase64 },
                  title: `${report.name} — ${report.title}`,
                },
              ]
            : []),
          { type: "text" as const, text: prompt },
        ],
      },
    ],
    // 매매모드: 현재가·52주 고저·밸류를 최신 웹검색으로 보강
    ...(mode === "trade" ? { tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 5 }] } : {}),
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        stream.abort();
      }, SOFT_DEADLINE_MS);
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            timedOut
              ? "\n\n> ⏱ 서버 실행 시간 한도(5분)에 가까워 여기서 멈췄어요. 이어서 보려면 '프롬프트 (복붙)' 탭으로 ChatGPT·Claude에서 돌려주세요."
              : `\n\n> ⚠ 분석 중 오류: ${(e as Error).message}`
          )
        );
      } finally {
        clearTimeout(timer);
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
