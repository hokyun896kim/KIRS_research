import { NextResponse } from "next/server";
import { fetchList, type Report } from "@/lib/kirs";
import { blobEnabled } from "@/lib/verdicts";
import { createBrief, getCachedBrief } from "@/lib/brief-service";
import { pool } from "@/lib/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RECENT_DAYS = 14;
const MAX_PER_RUN = 8;

// 매일 아침 크론: 최근 2주 신규 리포트 중 브리핑이 없는 것을 미리 만들어 둔다 (팝업이 바로 뜨게)
export async function GET() {
  if (!blobEnabled() || !process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Blob 또는 ANTHROPIC_API_KEY가 없어요." }, { status: 503 });
  const since = new Date(Date.now() - RECENT_DAYS * 86400000).toISOString().slice(0, 10);
  const pages = await Promise.all([1, 2].map((p) => fetchList(p).then((r) => r.reports).catch(() => [] as Report[])));
  const recent = pages.flat().filter((r) => r.no && r.pdfUrl && r.date >= since);

  const missing: Report[] = [];
  for (const r of recent) if (!(await getCachedBrief(r.no!))) missing.push(r);
  const todo = missing.slice(0, MAX_PER_RUN);

  const done = await pool(todo, 4, async (r) => {
    try {
      await createBrief(r.no!, r.pdfUrl!, { name: r.name, code: r.code, title: r.title, date: r.date, author: r.author });
      return { no: r.no, name: r.name, ok: true };
    } catch (e) {
      return { no: r.no, name: r.name, ok: false, error: (e as Error).message };
    }
  });
  return NextResponse.json({ since, recent: recent.length, missing: missing.length, generated: done });
}
