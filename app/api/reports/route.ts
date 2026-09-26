import { NextRequest, NextResponse } from "next/server";
import { fetchList } from "@/lib/kirs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const area = sp.get("area") ?? "";
  const keyword = sp.get("keyword") ?? "";
  try {
    return NextResponse.json(await fetchList(page, area, keyword));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
