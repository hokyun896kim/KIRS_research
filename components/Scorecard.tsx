"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Scorecard,
  HorizonKey,
  AnalystScore,
  ScoredReport,
} from "@/lib/scorecard";
import { Avatar } from "./ui";
import VerdictCheck from "./VerdictCheck";

const HORIZON_LABEL: Record<HorizonKey, string> = {
  "1M": "1개월",
  "3M": "3개월",
  "6M": "6개월",
  "12M": "12개월",
};
const MIN_N = 3; // 표본이 이보다 적으면 순위에서 제외

const pct = (v?: number) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const tone = (v?: number) =>
  v == null
    ? "text-slate-400"
    : v > 0
      ? "text-rose-600"
      : v < 0
        ? "text-blue-600"
        : "text-slate-600";

export default function ScorecardView() {
  const [data, setData] = useState<Scorecard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [h, setH] = useState<HorizonKey>("6M");
  const [onlyProfiled, setOnlyProfiled] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scorecard")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as Scorecard;
      })
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  const ranked = useMemo(() => {
    if (!data) return [];
    return data.analysts
      .filter((a) => (!onlyProfiled || a.type) && (a.stats[h]?.n ?? 0) >= MIN_N)
      .sort((a, b) => b.stats[h]!.avgExcess - a.stats[h]!.avgExcess);
  }, [data, h, onlyProfiled]);

  const overall = useMemo(() => {
    const ex = (data?.rows ?? [])
      .map((r) => r.excess[h])
      .filter((v): v is number => v != null);
    return ex.length
      ? {
          n: ex.length,
          avg: ex.reduce((a, b) => a + b, 0) / ex.length,
          win: ex.filter((v) => v > 0).length / ex.length,
        }
      : null;
  }, [data, h]);

  const rowsOf = (a: AnalystScore): ScoredReport[] =>
    (data?.rows ?? []).filter((r) => r.author === a.author);

  // 막대 길이 기준: 순위표 안 최대 |평균 초과|
  const maxAbs = Math.max(
    0.05,
    ...ranked.map((a) => Math.abs(a.stats[h]!.avgExcess)),
  );
  const MEDAL = ["🥇", "🥈", "🥉"];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:pt-8">
      <header className="mb-6">
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-indigo-600">
          발간일 종가 매수 가정 · 시장 대비 초과수익
        </p>
        <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 sm:text-[26px]">
          📊 애널리스트 적중률 성적표
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
          KIRS 리포트가 나온 날 샀다면 이후 얼마나 벌었을까요? 소속
          시장(KOSPI/KOSDAQ)보다 더 오른 만큼을 애널리스트별로 모아 봅니다.
        </p>
      </header>

      {!data && !err && (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white p-6 text-sm text-slate-500 shadow-card">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
          리포트 1,200여 건을 주가로 채점하는 중… (하루 한 번 새로 계산, 처음엔
          10초쯤 걸려요)
        </div>
      )}
      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          성적표를 불러오지 못했어요: {err}
        </div>
      )}

      {data && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-white p-1 text-sm shadow-card ring-1 ring-slate-200/70">
              {(Object.keys(HORIZON_LABEL) as HorizonKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setH(k)}
                  className={`rounded-lg px-3.5 py-1.5 font-semibold transition ${
                    h === k
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {HORIZON_LABEL[k]} 후
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-600">
              <input
                type="checkbox"
                checked={onlyProfiled}
                onChange={(e) => setOnlyProfiled(e.target.checked)}
                className="h-4 w-4 accent-slate-900"
              />
              14인 프로파일 애널만
            </label>
          </div>

          {overall && (
            <div className="mb-4 grid grid-cols-3 gap-2.5 sm:gap-3">
              {[
                {
                  k: `채점 리포트 · ${HORIZON_LABEL[h]}`,
                  v: `${overall.n.toLocaleString()}건`,
                  c: "text-slate-900",
                },
                {
                  k: "전체 평균 초과수익",
                  v: pct(overall.avg),
                  c: tone(overall.avg),
                },
                {
                  k: "시장을 이긴 비율",
                  v: `${(overall.win * 100).toFixed(0)}%`,
                  c: "text-slate-900",
                },
              ].map((x) => (
                <div
                  key={x.k}
                  className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-card sm:p-4"
                >
                  <div className="text-[11.5px] font-medium text-slate-400 sm:text-xs">
                    {x.k}
                  </div>
                  <div
                    className={`num mt-1 text-[19px] font-extrabold tracking-tight sm:text-[24px] ${x.c}`}
                  >
                    {x.v}
                  </div>
                </div>
              ))}
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
            <div className="hidden grid-cols-[44px_minmax(0,1.4fr)_64px_minmax(0,1.6fr)_80px_72px] items-center gap-3 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-400 md:grid">
              <span>순위</span>
              <span>애널리스트</span>
              <span className="text-right">채점</span>
              <span className="text-center">평균 초과수익 (시장 대비)</span>
              <span className="text-right">중앙값</span>
              <span className="text-right">승률</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {ranked.map((a, i) => {
                const st = a.stats[h]!;
                const isOpen = open === a.author;
                const w = (Math.abs(st.avgExcess) / maxAbs) * 50;
                return (
                  <li key={a.author}>
                    <button
                      onClick={() => setOpen(isOpen ? null : a.author)}
                      className={`grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 md:grid-cols-[44px_minmax(0,1.4fr)_64px_minmax(0,1.6fr)_80px_72px] md:px-5 ${
                        isOpen ? "bg-slate-50" : ""
                      }`}
                    >
                      <span className="num text-center text-[15px] font-bold text-slate-400">
                        {MEDAL[i] ?? i + 1}
                      </span>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar
                          name={a.author}
                          stance={a.stance ?? undefined}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-bold text-slate-900">
                            {a.author}
                          </span>
                          <span className="block truncate text-[11.5px] text-slate-400">
                            {a.type ?? "DB 미등록"}
                          </span>
                        </span>
                      </span>
                      {/* 모바일: 핵심 숫자만 */}
                      <span className="text-right md:hidden">
                        <span
                          className={`num block text-[15px] font-extrabold ${tone(st.avgExcess)}`}
                        >
                          {pct(st.avgExcess)}
                        </span>
                        <span className="num block text-[11px] text-slate-400">
                          승률 {(st.winRate * 100).toFixed(0)}% · {st.n}건
                        </span>
                      </span>
                      <span className="num hidden text-right text-[13px] text-slate-500 md:block">
                        {st.n}건
                      </span>
                      <span className="hidden items-center gap-2 md:flex">
                        <span className="relative h-2.5 flex-1 rounded-full bg-slate-100">
                          <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                          <span
                            className={`absolute inset-y-0 rounded-full ${st.avgExcess >= 0 ? "left-1/2 bg-rose-400" : "right-1/2 bg-blue-400"}`}
                            style={{ width: `${w}%` }}
                          />
                        </span>
                        <span
                          className={`num w-16 text-right text-[14px] font-extrabold ${tone(st.avgExcess)}`}
                        >
                          {pct(st.avgExcess)}
                        </span>
                      </span>
                      <span
                        className={`num hidden text-right text-[13px] md:block ${tone(st.medianExcess)}`}
                      >
                        {pct(st.medianExcess)}
                      </span>
                      <span className="hidden items-center justify-end gap-1.5 md:flex">
                        <span className="num text-[13px] font-semibold text-slate-700">
                          {(st.winRate * 100).toFixed(0)}%
                        </span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="bg-slate-50 px-4 pb-4 md:px-5">
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-[11px] font-medium text-slate-400">
                            <span>{a.author} 리포트 · 최신순</span>
                            <span>수익률 · 시장 대비 ({HORIZON_LABEL[h]})</span>
                          </div>
                          <ul className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
                            {rowsOf(a).map((r) => (
                              <li
                                key={`${r.no}-${r.date}`}
                                className="flex items-baseline gap-2 px-3 py-2 text-[12.5px]"
                              >
                                <span className="num w-[72px] shrink-0 text-slate-400">
                                  {r.date}
                                </span>
                                <span className="w-24 shrink-0 truncate font-semibold text-slate-700 sm:w-28">
                                  {r.name}
                                </span>
                                <span className="hidden min-w-0 flex-1 truncate text-slate-500 sm:block">
                                  {r.title}
                                </span>
                                <span
                                  className={`num ml-auto w-14 shrink-0 text-right ${tone(r.ret[h])}`}
                                >
                                  {pct(r.ret[h])}
                                </span>
                                <span
                                  className={`num w-14 shrink-0 text-right font-bold ${tone(r.excess[h])}`}
                                >
                                  {pct(r.excess[h])}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <VerdictCheck h={h} hLabel={HORIZON_LABEL[h]} />

          <p className="mt-6 text-xs leading-relaxed text-slate-400">
            기준: 발간일(이후 첫 거래일) 종가 → {HORIZON_LABEL[h]}(거래일 기준)
            뒤 종가, 수정주가·배당 미포함. 초과수익 = 종목 수익률 − 같은 기간
            소속 시장 지수 수익률. 표본 {MIN_N}건 미만은 순위에서 제외, 기간이
            안 찬 최근 리포트는 해당 기간 집계에서 빠집니다. 과거 성과가 미래
            수익을 보장하지 않습니다. · 채점{" "}
            <span className="num">
              {data.coverage.scored.toLocaleString()}/
              {data.coverage.reports.toLocaleString()}
            </span>
            건 · 갱신 {new Date(data.generatedAt).toLocaleString("ko-KR")}
          </p>
        </>
      )}
    </div>
  );
}
