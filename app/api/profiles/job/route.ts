import { NextRequest, NextResponse } from "next/server";
import { blobEnabled } from "@/lib/verdicts";
import { calibrateProfiles, getCalibrated, getJobState, getObservations, getProposal, proposeProfiles, submitGroup, syncBatches } from "@/lib/profile-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 애널 프로필 재검증 작업 (관리자 전용, 비용 발생). body: { key, action, group?, groups?, dryRun?, authors? }
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as {
    key?: string;
    action?: "submit" | "sync" | "propose" | "calibrate" | "get";
    group?: number;
    groups?: number;
    dryRun?: boolean;
    authors?: string[];
  };
  const keys = [process.env.ADMIN_KEY, process.env.JOB_KEY].filter(Boolean);
  if (!b.key || !keys.includes(b.key)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!blobEnabled() || !process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Blob 또는 API 키 없음" }, { status: 503 });

  try {
    switch (b.action) {
      case "submit": {
        const groups = Math.max(1, Math.min(4, b.groups ?? 2));
        return NextResponse.json(await submitGroup(Math.max(0, Math.min(groups - 1, b.group ?? 0)), groups, !!b.dryRun));
      }
      case "sync":
        return NextResponse.json({ batches: await syncBatches() });
      case "propose":
        return NextResponse.json(await proposeProfiles(b.authors));
      case "calibrate":
        return NextResponse.json(await calibrateProfiles());
      case "get":
        return NextResponse.json({ state: await getJobState(), proposal: await getProposal(), observations: await getObservations() });
      default:
        return NextResponse.json({ error: "action?" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 결과 조회만 (읽기 전용): ?key=&what=proposal|observations
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const keys = [process.env.ADMIN_KEY, process.env.JOB_KEY].filter(Boolean);
  if (!keys.includes(sp.get("key") ?? "")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const what = sp.get("what");
  const body = what === "observations" ? await getObservations() : what === "calibrated" ? await getCalibrated() : await getProposal();
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
