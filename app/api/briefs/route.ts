import { NextRequest, NextResponse } from "next/server";
import { getCachedBrief } from "@/lib/brief-service";
import { getContextSnapshot } from "@/lib/context-snapshot";
import type { BriefsResponse } from "@/lib/types";
import { getCohort, tierOf } from "@/lib/score-tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 목록 화면용: 저장된 브리핑 요약(새로 만들지는 않음)과 애널별 6개월 성과를 한 번에 돌려준다
export async function GET(req: NextRequest) {
  const nos = (req.nextUrl.searchParams.get("nos") ?? "")
    .split(",")
    .filter((n) => /^[0-9A-Za-z-]{1,20}$/.test(n))
    .slice(0, 40);

  const [hits, snap, cohort] = await Promise.all([
    Promise.all(nos.map((no) => getCachedBrief(no).catch(() => null))),
    getContextSnapshot().catch(() => null),
    getCohort(),
  ]);

  const briefs: BriefsResponse["briefs"] = {};
  hits.forEach((h, i) => {
    if (!h) return;
    const b = h.brief;
    briefs[nos[i]] = {
      verdict: tierOf(b.positiveOdds, cohort), // 모델 라벨이 아니라 긍정 가능성의 상대 순위
      priority: b.priority,
      positiveOdds: b.positiveOdds,
      conviction: b.conviction,
      headline: b.headline,
    };
  });

  const acc = new Map<string, number[]>();
  for (const [author, , , e6] of snap?.track ?? []) {
    if (e6 == null) continue;
    acc.set(author, [...(acc.get(author) ?? []), e6]);
  }
  const analysts: BriefsResponse["analysts"] = {};
  for (const [author, xs] of acc) {
    if (xs.length < 3) continue;
    analysts[author] = {
      avg6: xs.reduce((a, b) => a + b, 0) / xs.length,
      win6: xs.filter((v) => v > 0).length / xs.length,
      n6: xs.length,
    };
  }

  return NextResponse.json({ briefs, analysts } satisfies BriefsResponse, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
  });
}
