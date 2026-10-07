"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/types";
import type { Brief } from "@/lib/brief";

type Res = { brief: Brief; createdAt: string; model: string; cached: boolean };

const PRIORITY_STYLE: Record<Brief["priority"], string> = {
  상: "bg-rose-500 text-white",
  중: "bg-amber-400 text-amber-950",
  하: "bg-slate-500 text-white",
};
const VERDICT_LABEL: Record<Brief["verdict"], string> = {
  필독: "🔥 필독",
  참고: "📌 참고",
  패스: "⏭ 패스",
};
const oddsColor = (p: number) =>
  p >= 60 ? "#fb7185" : p >= 40 ? "#fbbf24" : "#38bdf8";

// 긍정적 결론 가능성 원형 게이지
function OddsRing({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[84px] w-[84px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="rgb(255 255 255 / 0.12)"
          strokeWidth="7"
        />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={oddsColor(value)}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="num text-[22px] font-extrabold leading-none text-white">
            {value}%
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/60">
            긍정 가능성
          </div>
        </div>
      </div>
    </div>
  );
}

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
        if (!r.ok)
          throw new Error(
            j.error === "NO_API_KEY"
              ? "서버에 ANTHROPIC_API_KEY가 없어 브리핑을 만들 수 없어요."
              : j.error || `HTTP ${r.status}`,
          );
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
    <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 px-5 py-4 text-white sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-semibold tracking-wide text-indigo-200">
                🧊 바이사이드 냉정 브리핑
              </span>
              {res && (
                <>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${PRIORITY_STYLE[res.brief.priority]}`}
                  >
                    검토 우선순위 {res.brief.priority}
                  </span>
                  <span className="num rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-white/90">
                    {VERDICT_LABEL[res.brief.verdict]} · 확신도{" "}
                    {res.brief.conviction}/5
                  </span>
                </>
              )}
            </div>
            {res ? (
              <p className="mt-2 text-[17px] font-bold leading-snug tracking-tight sm:text-[18px]">
                {res.brief.headline}
              </p>
            ) : err ? (
              <p className="mt-2 text-sm text-rose-200">
                브리핑을 만들지 못했어요: {err}
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="h-4 w-11/12 animate-pulse rounded bg-white/15" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/15" />
                <div className="pt-1 text-xs text-white/60">
                  리포트를 읽고 냉정하게 판단하는 중… 처음 여는 리포트는 30초
                  안팎 걸리고, 이후엔 바로 떠요.
                </div>
              </div>
            )}
          </div>
          {res && <OddsRing value={res.brief.positiveOdds} />}
        </div>
      </div>

      {res && <BriefBody b={res.brief} />}

      {res && (
        <div className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400 sm:px-6">
          AI 판단 ·{" "}
          <span className="num">
            {new Date(res.createdAt).toLocaleDateString("ko-KR")}
          </span>{" "}
          생성
          {res.cached ? " (저장된 결과)" : ""} · 리포트 본문과 과거 적중률만
          근거로 한 참고 의견이며 투자 권유가 아닙니다.
        </div>
      )}
    </section>
  );
}

function BriefBody({ b }: { b: Brief }) {
  return (
    <div className="space-y-5 px-5 py-5 sm:px-6">
      <div>
        <p className="text-[13.5px] leading-relaxed text-slate-600">
          {b.oddsReason}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          긍정 가능성 = 6~12개월 안에 리포트 핵심 논리가 실적·공시로 확인될 확률
          (50 = 반반)
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <Box
            title="✅ 이렇게 되면 긍정"
            items={b.bullConditions}
            tone="bg-emerald-50/80 text-emerald-800"
          />
          <Box
            title="💥 이러면 논리가 깨짐"
            items={b.killers}
            tone="bg-rose-50/80 text-rose-800"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <section>
          <h4 className="mb-2 text-[14px] font-bold text-slate-900">
            👀 봐야 할 이유
          </h4>
          <ol className="space-y-3">
            {b.whyLook.map((w, i) => (
              <li key={i} className="flex gap-2.5">
                <Num n={i + 1} tone="bg-indigo-50 text-indigo-600" />
                <div className="min-w-0 text-[13px] leading-snug">
                  <div className="font-semibold text-slate-900">{w.point}</div>
                  <div className="mt-1 rounded-md bg-slate-50 px-2 py-1.5 text-[12px] text-slate-500">
                    “{w.evidence}”
                  </div>
                  <div className="mt-1 text-slate-600">→ {w.soWhat}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h4 className="mb-2 text-[14px] font-bold text-slate-900">
            🔍 깊게 검토할 부분
          </h4>
          <ol className="space-y-3">
            {b.deepDive.map((d, i) => (
              <li key={i} className="flex gap-2.5">
                <Num n={i + 1} tone="bg-amber-50 text-amber-700" />
                <div className="min-w-0 text-[13px] leading-snug">
                  <div className="font-semibold text-slate-900">{d.issue}</div>
                  <div className="mt-1 text-slate-600">{d.why}</div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    <span className="font-semibold text-slate-600">확인 →</span>{" "}
                    {d.check}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {b.redFlags.length > 0 && (
        <Box
          title="🚩 리포트가 말하지 않거나 짧게 넘긴 것"
          items={b.redFlags}
          tone="bg-amber-50/80 text-amber-900"
        />
      )}

      <div className="flex gap-2.5 rounded-xl bg-slate-100/80 p-3.5 text-[13px] leading-snug text-slate-700">
        <span>🧭</span>
        <div>
          <span className="font-bold text-slate-900">애널 성향 보정 </span>
          {b.lensNote}
        </div>
      </div>
    </div>
  );
}

function Num({ n, tone }: { n: number; tone: string }) {
  return (
    <span
      className={`num grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${tone}`}
    >
      {n}
    </span>
  );
}

function Box({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${tone}`}>
      <div className="text-[12.5px] font-bold">{title}</div>
      <ul className="mt-1 space-y-0.5">
        {items.map((t, i) => (
          <li
            key={i}
            className="flex gap-1.5 text-[12.5px] leading-snug opacity-90"
          >
            <span className="opacity-50">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
