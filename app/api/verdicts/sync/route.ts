import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { blobEnabled, deleteBatch, deleteVerdicts, listBatches, saveVerdict } from "@/lib/verdicts";
import { BACKFILL_MODEL, noFromCustomId, upsideFrom, type BackfillResult } from "@/lib/backfill";
import { getReportIndex } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 제출해 둔 일괄 판정 배치를 확인하고, 끝난 배치의 결과를 판정 저장소로 옮긴다. (비용 없음 · 매일 크론)
export async function GET() {
  if (!blobEnabled() || !process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Blob 또는 ANTHROPIC_API_KEY가 없어요." }, { status: 503 });
  const client = new Anthropic();
  const batches = await listBatches();
  const meta = new Map((await getReportIndex()).map((r) => [r.no, r]));
  const report: { id: string; status: string; saved?: number; failed?: number; counts?: unknown }[] = [];

  for (const b of batches) {
    const info = await client.messages.batches.retrieve(b.id);
    if (info.processing_status !== "ended") {
      report.push({ id: b.id, status: info.processing_status, counts: info.request_counts });
      continue;
    }
    let saved = 0, failed = 0;
    for await (const r of await client.messages.batches.results(b.id)) {
      if (r.result.type !== "succeeded") {
        failed++;
        continue;
      }
      const block = r.result.message.content.find((c) => c.type === "text");
      try {
        const j = JSON.parse(block && block.type === "text" ? block.text : "") as BackfillResult;
        const no = noFromCustomId(r.custom_id);
        const m = meta.get(no);
        // 예전 형식(baseUpside %)으로 낸 배치도 받는다
        const legacy = (j as unknown as { baseUpside?: number | null }).baseUpside;
        const baseUpside = j.valuation ? upsideFrom(j.valuation) : legacy == null ? null : legacy / 100;
        await deleteVerdicts(no, "backfill"); // 다시 돌린 일괄 판정은 최신 결과 하나만 남긴다
        await saveVerdict(
          {
            no,
            mode: "backfill",
            verdict: j.verdict,
            conviction: Math.max(1, Math.min(5, j.conviction)),
            relative: j.relative,
            baseUpside,
            createdAt: new Date().toISOString(),
          },
          { name: m?.name, code: m?.code, date: m?.date, author: m?.author, model: BACKFILL_MODEL, reason: j.reason, evidence: j.evidence, valuation: j.valuation }
        );
        saved++;
      } catch {
        failed++;
      }
    }
    await deleteBatch(b.id);
    report.push({ id: b.id, status: "ended", saved, failed });
  }
  return NextResponse.json({ batches: report });
}
