import { NextRequest, NextResponse } from "next/server";
import { getVerdictStats } from "@/lib/verdict-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get("all") === "1";
  try {
    return NextResponse.json(await getVerdictStats(all));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
