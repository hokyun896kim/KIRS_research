import { NextResponse, after } from "next/server";
import { getScorecard } from "@/lib/scorecard";
import { getReportIndex } from "@/lib/history";
import { refreshContextSnapshot } from "@/lib/context-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    const sc = await getScorecard();
    // 분석 프롬프트용 성적·이력 스냅샷: 성적표가 새로 계산됐을 때만 다시 쓴다 (매일 아침 크론이 이 경로를 부름)
    after(() =>
      getReportIndex()
        .then((index) => refreshContextSnapshot(sc, index))
        .catch((e) => console.warn(`[context-snapshot] refresh failed: ${(e as Error).message}`))
    );
    return NextResponse.json(sc);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
