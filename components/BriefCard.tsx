"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/types";
import type { Brief } from "@/lib/brief";
import { VerdictBadge, oddsBar, oddsTone } from "./ui";

export type BriefRes = { brief: Brief; createdAt: string; model: string; cached: boolean };

// 바이사이드 냉정 브리핑: 저장돼 있으면 바로, 없으면 서버가 만들어 저장 (30초 안팎)
export function useBrief(report: Report) {
  const [res, setRes] = useState<BriefRes | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!report.pdfUrl || !report.no) return;
    let alive = true;
    setRes(null);
    setErr(null);
    const qs = new URLSearchParams({
      no: report.no,
      url: report.pdfUrl,
      name: report.name,
      code: report.code ?? "",
      title: report.title,
      date: report.date,
      author: report.author,
    });
    fetch(`/api/brief?${qs.toString()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok)
          throw new Error(j.error === "NO_API_KEY" ? "서버에 ANTHROPIC_API_KEY가 없어 브리핑을 만들 수 없어요." : j.error || `HTTP ${r.status}`);
        return j as BriefRes;
      })
      .then((j) => alive && setRes(j))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [report]);

  return { res, err, enabled: !!(report.pdfUrl && report.no) };
}

// 상단 요약: 판정 · 한 줄 결론 · 긍정 가능성
export function BriefHero({ res, err }: { res: BriefRes | null; err: string | null }) {
  if (err)
    return (
      <div className="rounded-2xl bg-g50 p-4 text-[14px] text-g600">
        브리핑을 만들지 못했어요. <span className="text-g400">{err}</span>
      </div>
    );
  if (!res)
    return (
      <div className="rounded-3xl bg-g50 p-5">
        <div className="h-5 w-20 animate-pulse rounded-md bg-g200" />
        <div className="mt-3 h-6 w-11/12 animate-pulse rounded-md bg-g200" />
        <div className="mt-2 h-6 w-2/3 animate-pulse rounded-md bg-g200" />
        <p className="mt-4 text-[13px] text-g500">AI가 리포트를 읽고 냉정하게 판단하는 중이에요. 처음 여는 리포트는 30초쯤 걸려요.</p>
      </div>
    );
  const b = res.brief;
  return (
    <div className="rounded-3xl bg-g50 p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <VerdictBadge verdict={b.verdict} size="md" />
        <span className="text-[13px] font-medium text-g600">
          검토 우선순위 {b.priority} · 확신도 <span className="num">{b.conviction}/5</span>
        </span>
      </div>
      <p className="mt-3 text-[19px] font-bold leading-snug tracking-tight text-g900">{b.headline}</p>
      <div className="mt-5">
        <div className="flex items-end justify-between">
          <span className="text-[14px] font-medium text-g600">긍정 결론 가능성</span>
          <span className={`num text-[30px] font-bold leading-none ${oddsTone(b.positiveOdds)}`}>{b.positiveOdds}%</span>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-g200">
          <div className={`h-full rounded-full ${oddsBar(b.positiveOdds)}`} style={{ width: `${b.positiveOdds}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-g500">6~12개월 안에 리포트 핵심 논리가 실적·공시로 확인될 확률 (50 = 반반)</p>
      </div>
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-[17px] font-bold tracking-tight text-g900">{children}</h3>;
}

function Num({ n, tone }: { n: number; tone: string }) {
  return <span className={`num grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${tone}`}>{n}</span>;
}

function Bullets({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-g700">
          <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

// 브리핑 본문 (상세 탭)
export function BriefBody({ res }: { res: BriefRes }) {
  const b = res.brief;
  return (
    <div className="space-y-8">
      <section>
        <Sub>왜 이 확률인가요</Sub>
        <p className="text-[15px] leading-relaxed text-g700">{b.oddsReason}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-tr-50/60 p-4">
          <div className="mb-2 text-[14px] font-bold text-tr">이렇게 되면 긍정</div>
          <Bullets items={b.bullConditions} dot="bg-tr" />
        </div>
        <div className="rounded-2xl bg-tb-50/70 p-4">
          <div className="mb-2 text-[14px] font-bold text-tb">이러면 논리가 깨져요</div>
          <Bullets items={b.killers} dot="bg-tb" />
        </div>
      </section>

      <section>
        <Sub>봐야 할 이유</Sub>
        <ol className="space-y-5">
          {b.whyLook.map((w, i) => (
            <li key={i} className="flex gap-3">
              <Num n={i + 1} tone="bg-g900 text-white" />
              <div className="min-w-0">
                <div className="text-[16px] font-semibold leading-snug text-g900">{w.point}</div>
                <blockquote className="mt-2 border-l-2 border-g200 pl-3 text-[14px] leading-relaxed text-g600">{w.evidence}</blockquote>
                <p className="mt-2 text-[15px] leading-relaxed text-g700">{w.soWhat}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <Sub>깊게 검토할 부분</Sub>
        <ol className="space-y-5">
          {b.deepDive.map((d, i) => (
            <li key={i} className="flex gap-3">
              <Num n={i + 1} tone="bg-g200 text-g800" />
              <div className="min-w-0">
                <div className="text-[16px] font-semibold leading-snug text-g900">{d.issue}</div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-g700">{d.why}</p>
                <p className="mt-2 rounded-xl bg-g50 px-3 py-2 text-[14px] leading-relaxed text-g700">
                  <span className="font-semibold text-g900">확인할 것 </span>
                  {d.check}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {b.redFlags.length > 0 && (
        <section className="rounded-2xl bg-to-50 p-4">
          <div className="mb-2 text-[14px] font-bold text-orange-700">리포트가 말하지 않거나 짧게 넘긴 것</div>
          <Bullets items={b.redFlags} dot="bg-to" />
        </section>
      )}

      <section className="rounded-2xl bg-g50 p-4">
        <div className="mb-1.5 text-[14px] font-bold text-g900">애널 성향 감안하기</div>
        <p className="text-[15px] leading-relaxed text-g700">{b.lensNote}</p>
      </section>

      <p className="text-[12px] leading-relaxed text-g400">
        AI 판단 · <span className="num">{new Date(res.createdAt).toLocaleDateString("ko-KR")}</span> 생성
        {res.cached ? " (저장된 결과)" : ""} · 리포트 본문과 과거 적중률만 근거로 한 참고 의견이며 투자 권유가 아니에요.
      </p>
    </div>
  );
}
