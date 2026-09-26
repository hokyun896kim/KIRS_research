import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isAllowedPdfUrl } from "@/lib/kirs";
import { counterProfile, matchProfile } from "@/lib/profiles";
import { classifySector } from "@/lib/sector";
import { buildPrompt, buildCounterPrompt, buildComparePrompt } from "@/lib/prompt";
import { getGuideline } from "@/lib/guideline-loader";
import { loadReport, metaFrom, type ReportMeta } from "@/lib/report-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";
// PDF 원본을 그대로 보내면 표·차트까지 읽는다. 요청 한도(32MB) 안쪽만 첨부하고, 넘으면 추출 텍스트로 대체.
const MAX_PDF_BYTES = 20 * 1024 * 1024;
// maxDuration(300초) 전에 스스로 끊어서 504 대신 "여기까지 분석" 안내를 남긴다.
const SOFT_DEADLINE_MS = 280_000;

type Mode = "full" | "trade" | "counter" | "compare";
type Side = Partial<ReportMeta> & { url?: string };
type Body = Side & {
  mode?: Mode;
  lens?: string; // 반론모드 렌즈 애널 이름
  prev?: Side; // 비교모드: 이전 리포트
};

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Body;
  const mode: Mode = b.mode === "trade" || b.mode === "counter" || b.mode === "compare" ? b.mode : "full";
  if (!b.url) return NextResponse.json({ error: "url required" }, { status: 400 });
  if (mode === "compare" && !b.prev?.url) return NextResponse.json({ error: "prev required" }, { status: 400 });
  if (!isAllowedPdfUrl(b.url) || (b.prev?.url && !isAllowedPdfUrl(b.prev.url)))
    return NextResponse.json({ error: "domain not allowed" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });

  const report = metaFrom((k) => b[k as keyof ReportMeta] as string | null | undefined);

  let prompt: string;
  let pdfs: { data: string; title: string }[] = [];
  try {
    const cur = await loadReport(b.url, report);
    if (mode === "compare") {
      const prevMeta = metaFrom((k) => b.prev?.[k as keyof ReportMeta] as string | null | undefined);
      const prev = await loadReport(b.prev!.url!, prevMeta);
      const attach = cur.buf.length + prev.buf.length <= MAX_PDF_BYTES;
      if (attach)
        pdfs = [
          { data: cur.buf.toString("base64"), title: `이번 리포트 ${cur.report.date} — ${cur.report.title}` },
          { data: prev.buf.toString("base64"), title: `이전 리포트 ${prev.report.date} — ${prev.report.title}` },
        ];
      const side = (r: typeof cur) => ({ report: r.report, analyst: r.analyst, profile: r.profile, pdfText: r.text });
      prompt = buildComparePrompt({ current: side(cur), previous: side(prev), attachedPdf: attach });
    } else {
      if (cur.buf.length <= MAX_PDF_BYTES)
        pdfs = [{ data: cur.buf.toString("base64"), title: `${report.name} — ${report.title}` }];
      const base = {
        guideline: getGuideline(),
        report,
        analyst: cur.analyst,
        ra: cur.ra,
        profile: cur.profile,
        raProfile: cur.raProfile,
        pdfText: cur.text,
        sector: classifySector(report.name, report.title).label,
        attachedPdf: pdfs.length > 0,
      };
      const exclude = [cur.analyst, cur.ra].filter((x): x is string => !!x);
      prompt =
        mode === "counter"
          ? buildCounterPrompt({ ...base, lens: matchProfile(b.lens) ?? counterProfile(cur.profile, exclude) })
          : buildPrompt({ ...base, mode });
    }
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
          ...pdfs.map((p) => ({
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: p.data },
            title: p.title,
          })),
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
