import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getReportIndex } from "@/lib/history";
import { loadReport } from "@/lib/report-input";
import { blobEnabled, listBatches, listVerdicts, saveBatch } from "@/lib/verdicts";
import { FAIR_SINCE, batchParams, buildVerdictPrompt, customIdFor, estimateCostUSD } from "@/lib/backfill";
import { pool } from "@/lib/pool";
import { getAnalysisContext } from "@/lib/analysis-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_LIMIT = 80; // 한 번에 PDF 추출할 수 있는 양 (300초 안)

// 과거 리포트 일괄 판정 배치를 제출한다. 비용이 드므로 ADMIN_KEY가 맞아야 한다.
// body: { key, since?: "YYYY-MM-DD", limit?: number, dryRun?: boolean }
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { key?: string; since?: string; limit?: number; dryRun?: boolean };
  if (!process.env.ADMIN_KEY) return NextResponse.json({ error: "서버에 ADMIN_KEY가 설정되지 않았어요." }, { status: 503 });
  if (b.key !== process.env.ADMIN_KEY) return NextResponse.json({ error: "관리자 키가 맞지 않아요." }, { status: 401 });
  if (!blobEnabled()) return NextResponse.json({ error: "Blob 저장소가 연결되지 않았어요." }, { status: 503 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "NO_API_KEY" }, { status: 503 });

  const since = /^\d{4}-\d{2}-\d{2}$/.test(b.since ?? "") ? b.since! : FAIR_SINCE;
  const limit = Math.min(Math.max(1, Number(b.limit) || 40), MAX_LIMIT);

  const [index, verdicts, batches] = await Promise.all([getReportIndex(), listVerdicts(), listBatches()]);
  const done = new Set([...verdicts.map((v) => v.no), ...batches.flatMap((x) => x.ids)]);
  // 오래된 것부터: 수익률 기간(6·12개월)이 먼저 찬 리포트가 먼저 채점되도록
  const candidates = index
    .filter((r) => r.no && r.pdfUrl && r.date >= since && !done.has(r.no))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pick = candidates.slice(0, limit);

  const loaded = await pool(pick, 6, async (r) => {
    try {
      const meta = { name: r.name, code: r.code, title: r.title, date: r.date, author: r.author };
      const ctx = await getAnalysisContext(meta); // PDF 파싱보다 먼저 (analysis-context.ts)
      const L = await loadReport(r.pdfUrl!, meta);
      return { no: r.no!, prompt: buildVerdictPrompt(L.report, L.profile, L.analyst, L.text, ctx) };
    } catch {
      return null;
    }
  });
  const reqs = loaded.filter((x): x is { no: string; prompt: string } => x != null);
  const estCostUSD = estimateCostUSD(reqs.map((r) => r.prompt.length));
  const base = { since, candidates: candidates.length, submitted: reqs.length, remaining: candidates.length - reqs.length, estCostUSD };
  if (b.dryRun || reqs.length === 0) return NextResponse.json({ ...base, submitted: 0, dryRun: true, wouldSubmit: reqs.length });

  const client = new Anthropic();
  const batch = await client.messages.batches.create({
    requests: reqs.map((r) => ({ custom_id: customIdFor(r.no), params: batchParams(r.prompt) })),
  });
  await saveBatch({ id: batch.id, ids: reqs.map((r) => r.no), since, createdAt: new Date().toISOString() });
  return NextResponse.json({ ...base, batchId: batch.id });
}
