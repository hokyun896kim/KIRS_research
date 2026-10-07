import { NextResponse } from "next/server";
import { getAnalystFacts } from "@/lib/analyst-facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const facts = await getAnalystFacts().catch(() => ({}));
  return NextResponse.json({ facts }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
