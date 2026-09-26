"use client";

import { useEffect, useMemo, useState } from "react";
import type { Scorecard, HorizonKey, AnalystScore, ScoredReport } from "@/lib/scorecard";
import { stanceDot } from "./AnalystCard";

const HORIZON_LABEL: Record<HorizonKey, string> = { "1M": "1개월", "3M": "3개월", "6M": "6개월", "12M": "12개월" };
const MIN_N = 3; // 표본이 이보다 적으면 순위에서 제외

const pct = (v?: number) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const tone = (v?: number) => (v == null ? "text-slate-400" : v > 0 ? "text-rose-600" : v < 0 ? "text-blue-600" : "text-slate-600");

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
    const ex = (data?.rows ?? []).map((r) => r.excess[h]).filter((v): v is number => v != null);
    return ex.length ? { n: ex.length, avg: ex.reduce((a, b) => a + b, 0) / ex.length, win: ex.filter((v) => v > 0).length / ex.length } : null;
  }, [data, h]);

  const rowsOf = (a: AnalystScore): ScoredReport[] => (data?.rows ?? []).filter((r) => r.author === a.author);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">📊 애널리스트 적중률 성적표</h1>
          <p className="mt-1 text-sm text-slate-500">
            KIRS 리포트 발간일 종가에 샀다면 이후 얼마나 벌었나 — <b>소속 시장(KOSPI/KOSDAQ) 대비 초과수익률</b>로 채점합니다.
          </p>
        </div>
        <a href="/" className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          ← 리포트 목록
        </a>
      </header>

      {!data && !err && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
          리포트 1,200여 건을 주가로 채점하는 중… 처음 계산할 땐 1~2분 걸려요 (하루 한 번 갱신).
        </div>
      )}
      {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">성적표를 불러오지 못했어요: {err}</div>}

      {data && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              {(Object.keys(HORIZON_LABEL) as HorizonKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setH(k)}
                  className={`rounded-md px-3 py-1.5 font-medium ${h === k ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}
                >
                  {HORIZON_LABEL[k]} 후
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={onlyProfiled} onChange={(e) => setOnlyProfiled(e.target.checked)} />
              14인 프로파일 애널만
            </label>
          </div>

          {overall && (
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-400">채점된 리포트 ({HORIZON_LABEL[h]})</div>
                <div className="text-lg font-bold text-slate-900">{overall.n.toLocaleString()}건</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-400">전체 평균 초과수익</div>
                <div className={`text-lg font-bold ${tone(overall.avg)}`}>{pct(overall.avg)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs text-slate-400">시장을 이긴 비율</div>
                <div className="text-lg font-bold text-slate-900">{(overall.win * 100).toFixed(0)}%</div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">애널리스트</th>
                  <th className="px-3 py-2 text-right font-medium">채점 수</th>
                  <th className="px-3 py-2 text-right font-medium">평균 초과</th>
                  <th className="px-3 py-2 text-right font-medium">중앙값</th>
                  <th className="px-3 py-2 text-right font-medium">승률</th>
                  <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">평균 수익률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranked.map((a, i) => {
                  const s = a.stats[h]!;
                  const isOpen = open === a.author;
                  return (
                    <FragmentRows key={a.author}>
                      <tr onClick={() => setOpen(isOpen ? null : a.author)} className="cursor-pointer hover:bg-blue-50/50">
                        <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${stanceDot(a.stance ?? undefined)}`} />
                            <span className="font-medium text-slate-800">{a.author}</span>
                            {a.type && <span className="text-xs text-slate-400">{a.type}</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{s.n}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${tone(s.avgExcess)}`}>{pct(s.avgExcess)}</td>
                        <td className={`px-3 py-2.5 text-right ${tone(s.medianExcess)}`}>{pct(s.medianExcess)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{(s.winRate * 100).toFixed(0)}%</td>
                        <td className={`hidden px-3 py-2.5 text-right sm:table-cell ${tone(s.avgRet)}`}>{pct(s.avgRet)}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 px-3 py-2">
                            <ul className="space-y-1">
                              {rowsOf(a).map((r) => (
                                <li key={`${r.no}-${r.date}`} className="flex items-baseline gap-2 text-xs">
                                  <span className="w-20 shrink-0 text-slate-400">{r.date}</span>
                                  <span className="w-28 shrink-0 truncate font-medium text-slate-700">{r.name}</span>
                                  <span className="min-w-0 flex-1 truncate text-slate-500">{r.title}</span>
                                  <span className={`w-16 shrink-0 text-right ${tone(r.ret[h])}`}>{pct(r.ret[h])}</span>
                                  <span className={`w-16 shrink-0 text-right font-semibold ${tone(r.excess[h])}`}>{pct(r.excess[h])}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-1 text-right text-[11px] text-slate-400">수익률 · 시장 대비 초과</div>
                          </td>
                        </tr>
                      )}
                    </FragmentRows>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            기준: 발간일(이후 첫 거래일) 종가 → {HORIZON_LABEL[h]}(거래일 기준) 뒤 종가, 수정주가·배당 미포함. 초과수익 = 종목 수익률 − 같은 기간
            소속 시장 지수 수익률. 표본 {MIN_N}건 미만은 순위에서 제외, 기간이 안 찬 최근 리포트는 해당 기간 집계에서 빠집니다. 과거 성과가 미래
            수익을 보장하지 않습니다. · 채점 {data.coverage.scored.toLocaleString()}/{data.coverage.reports.toLocaleString()}건 · 갱신{" "}
            {new Date(data.generatedAt).toLocaleString("ko-KR")}
          </p>
        </>
      )}
    </div>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
