"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/types";
import type { Brief } from "@/lib/brief";

type Res = { brief: Brief; createdAt: string; model: string; cached: boolean };

const PRIORITY_STYLE: Record<Brief["priority"], string> = {
  상: "bg-rose-600 text-white",
  중: "bg-amber-400 text-amber-950",
  하: "bg-slate-200 text-slate-600",
};
const VERDICT_STYLE: Record<Brief["verdict"], string> = {
  필독: "🔥 필독",
  참고: "📌 참고",
  패스: "⏭ 패스",
};
const oddsTone = (p: number) => (p >= 60 ? "bg-rose-500" : p >= 40 ? "bg-amber-400" : "bg-sky-500");

export default function BriefCard({ report }: { report: Report }) {
  const [res, setRes] = useState<Res | null>(null);
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
        if (!r.ok) throw new Error(j.error === "NO_API_KEY" ? "서버에 ANTHROPIC_API_KEY가 없어 브리핑을 만들 수 없어요." : j.error || `HTTP ${r.status}`);
        return j as Res;
      })
      .then((j) => alive && setRes(j))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [report]);

  if (!report.pdfUrl || !report.no) return null;

  return (
    <div className="rounded-xl border border-slate-300 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-900">🧊 바이사이드 냉정 브리핑</span>
        {res && (
          <>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${PRIORITY_STYLE[res.brief.priority]}`}>
              검토 우선순위 {res.brief.priority}
            </span>
            <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
              {VERDICT_STYLE[res.brief.verdict]} · 확신도 {res.brief.conviction}/5
            </span>
          </>
        )}
      </div>

      {!res && !err && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            리포트를 읽고 냉정하게 판단하는 중… 처음 여는 리포트는 1분 정도 걸리고, 이후엔 바로 떠요. (최근 2주 리포트는 매일 아침 미리 만들어 둡니다)
          </div>
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        </div>
      )}
      {err && <div className="text-xs text-red-600">브리핑을 만들지 못했어요: {err}</div>}

      {res && <BriefBody b={res.brief} />}

      {res && (
        <div className="mt-3 text-[11px] text-slate-400">
          AI 판단 · {new Date(res.createdAt).toLocaleDateString("ko-KR")} 생성{res.cached ? " (저장된 결과)" : ""} · 리포트 본문과
          과거 적중률만 근거로 한 참고 의견이며 투자 권유가 아닙니다.
        </div>
      )}
    </div>
  );
}

function BriefBody({ b }: { b: Brief }) {
  return (
    <div className="space-y-3">
      <p className="text-[15px] font-semibold leading-snug text-slate-900">{b.headline}</p>

      {/* 긍정적 결론 가능성 */}
      <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-slate-700">📈 긍정적 결론 가능성</span>
          <span className="text-lg font-bold text-slate-900">{b.positiveOdds}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${oddsTone(b.positiveOdds)}`} style={{ width: `${b.positiveOdds}%` }} />
        </div>
        <p className="mt-1.5 text-[12.5px] leading-snug text-slate-600">{b.oddsReason}</p>
        <p className="mt-1 text-[11px] text-slate-400">6~12개월 안에 리포트 핵심 논리가 실적·공시로 확인될 가능성 (50 = 반반)</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <List title="✅ 이렇게 되면 긍정" items={b.bullConditions} tone="text-emerald-700" />
          <List title="💥 이러면 논리가 깨짐" items={b.killers} tone="text-rose-700" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section>
          <h4 className="mb-1 text-[13px] font-semibold text-slate-800">👀 봐야 할 이유 (핵심 검토 포인트)</h4>
          <ul className="space-y-2">
            {b.whyLook.map((w, i) => (
              <li key={i} className="text-[12.5px] leading-snug">
                <div className="font-medium text-slate-800">{w.point}</div>
                <div className="mt-0.5 border-l-2 border-slate-200 pl-2 text-slate-500">“{w.evidence}”</div>
                <div className="mt-0.5 text-slate-600">→ {w.soWhat}</div>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="mb-1 text-[13px] font-semibold text-slate-800">🔍 깊게 검토할 부분</h4>
          <ul className="space-y-2">
            {b.deepDive.map((d, i) => (
              <li key={i} className="text-[12.5px] leading-snug">
                <div className="font-medium text-slate-800">{d.issue}</div>
                <div className="mt-0.5 text-slate-600">{d.why}</div>
                <div className="mt-0.5 text-slate-500">✔ 확인: {d.check}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {b.redFlags.length > 0 && <List title="🚩 리포트가 말하지 않거나 짧게 넘긴 것" items={b.redFlags} tone="text-amber-800" />}

      <div className="rounded-md bg-slate-100 px-3 py-2 text-[12.5px] leading-snug text-slate-700">
        <span className="font-semibold">🧭 애널 성향 보정 · </span>
        {b.lensNote}
      </div>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <div className={`text-[12px] font-semibold ${tone}`}>{title}</div>
      <ul className="mt-0.5 space-y-0.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug text-slate-600">
            <span className="opacity-50">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
