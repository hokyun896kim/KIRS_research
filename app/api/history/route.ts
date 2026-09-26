import { NextRequest, NextResponse } from "next/server";
import { findSameCompany } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code") || null;
  const name = sp.get("name") ?? "";
  if (!code && !name) return NextResponse.json({ error: "code or name required" }, { status: 400 });
  try {
    return NextResponse.json({ reports: await findSameCompany(code, name) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
