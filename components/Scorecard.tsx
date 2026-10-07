"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Scorecard,
  HorizonKey,
  AnalystScore,
  ScoredReport,
} from "@/lib/scorecard";
import { Avatar, Block, BlockTitle, Spinner, pct, retTone as tone } from "./ui";
import { MIN_TRACK_N } from "./AnalystCard";
import VerdictCheck from "./VerdictCheck";

const HORIZON_LABEL: Record<HorizonKey, string> = {
  "1M": "1개월",
  "3M": "3개월",
  "6M": "6개월",
  "12M": "12개월",
};
const MIN_N = MIN_TRACK_N; // 표본이 이보다 적으면 순위에서 제외


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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-2.5 pb-16 sm:space-y-4 sm:px-5 sm:pt-6">
      <Block>
        <p className="text-[14px] font-medium text-g500">발간일 종가에 샀다고 가정</p>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-g900 sm:text-[26px]">애널 성적표</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-g600">
          KIRS 리포트가 나온 날 샀다면, 소속 시장(코스피·코스닥)보다 얼마나 더 벌었을까요?
        </p>

        <div className="mt-5 grid grid-cols-4 rounded-2xl bg-g100 p-1">
          {(Object.keys(HORIZON_LABEL) as HorizonKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setH(k)}
              className={`h-10 rounded-xl text-[15px] font-semibold transition ${
                h === k ? "bg-white text-g900 shadow-sm" : "text-g500 hover:text-g700"
              }`}
            >
              {HORIZON_LABEL[k]} 뒤
            </button>
          ))}
        </div>

        {!data && !err && (
          <div className="mt-5 flex items-center gap-2.5 text-[15px] text-g500">
            <Spinner /> 리포트 1,200여 건을 주가로 채점하는 중이에요
          </div>
        )}
        {err && <p className="mt-5 text-[15px] text-g600">성적표를 불러오지 못했어요. {err}</p>}

        {overall && (
          <div className="mt-4 grid grid-cols-3 divide-x divide-g200 rounded-2xl bg-g50 py-4 text-center">
            <div>
              <div className="text-[13px] text-g500">채점 리포트</div>
              <div className="num mt-1 text-[20px] font-bold text-g900 sm:text-[22px]">{overall.n.toLocaleString()}건</div>
            </div>
            <div>
              <div className="text-[13px] text-g500">평균 초과수익</div>
              <div className={`num mt-1 text-[20px] font-bold sm:text-[22px] ${tone(overall.avg)}`}>{pct(overall.avg)}</div>
            </div>
            <div>
              <div className="text-[13px] text-g500">시장 이긴 비율</div>
              <div className="num mt-1 text-[20px] font-bold text-g900 sm:text-[22px]">{(overall.win * 100).toFixed(0)}%</div>
            </div>
          </div>
        )}
      </Block>

      {data && (
        <>
          <Block>
            <BlockTitle
              sub={`${HORIZON_LABEL[h]} 뒤 시장 대비 평균 초과수익 순 · 누르면 리포트별 기록`}
              right={
                <button
                  onClick={() => setOnlyProfiled((v) => !v)}
                  className={`press h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold ${
                    onlyProfiled ? "bg-g800 text-white" : "bg-g100 text-g700"
                  }`}
                >
                  도감 14인만
                </button>
              }
            >
              누가 잘 맞혔을까
            </BlockTitle>

            <ul>
              {ranked.map((a, i) => {
                const st = a.stats[h]!;
                const isOpen = open === a.author;
                const w = (Math.abs(st.avgExcess) / maxAbs) * 50;
                return (
                  <li key={a.author} className="border-b border-g100 last:border-0">
                    <button
                      onClick={() => setOpen(isOpen ? null : a.author)}
                      className="press grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-1 py-3.5 text-left hover:bg-g50 md:grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_132px]"
                    >
                      <span className={`num text-center text-[17px] font-bold ${i < 3 ? "text-tb" : "text-g500"}`}>{i + 1}</span>
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar name={a.author} stance={a.stance ?? undefined} />
                        <span className="min-w-0">
                          <span className="block truncate text-[16px] font-semibold text-g900">{a.author}</span>
                          <span className="block truncate text-[13px] text-g500">{a.type ?? "도감 미등록"}</span>
                        </span>
                      </span>
                      <span className="relative hidden h-2 rounded-full bg-g100 md:block">
                        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-g300" />
                        <span
                          className={`absolute inset-y-0 rounded-full ${st.avgExcess >= 0 ? "left-1/2 bg-tr" : "right-1/2 bg-tb"}`}
                          style={{ width: `${w}%` }}
                        />
                      </span>
                      <span className="text-right">
                        <span className={`num block text-[17px] font-bold ${tone(st.avgExcess)}`}>{pct(st.avgExcess)}</span>
                        <span className="num block text-[13px] text-g500">
                          승률 {(st.winRate * 100).toFixed(0)}% · {st.n}건
                        </span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mb-3 rounded-2xl bg-g50 p-2">
                        <div className="flex justify-between px-3 py-2 text-[12px] text-g500">
                          <span>
                            최신순 · 중앙값 <span className={`num font-semibold ${tone(st.medianExcess)}`}>{pct(st.medianExcess)}</span>
                          </span>
                          <span>수익률 · 시장 대비</span>
                        </div>
                        <ul className="max-h-96 overflow-y-auto">
                          {rowsOf(a).map((r) => (
                            <li key={`${r.no}-${r.date}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold text-g900">{r.name}</span>
                                <span className="num block truncate text-[13px] text-g500">
                                  {r.date.replaceAll("-", ".")} · {r.title}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className={`num block text-[15px] font-bold ${tone(r.excess[h])}`}>{pct(r.excess[h])}</span>
                                <span className={`num block text-[12px] ${tone(r.ret[h])}`}>{pct(r.ret[h])}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Block>

          <VerdictCheck h={h} hLabel={HORIZON_LABEL[h]} />

          <p className="px-5 text-[12px] leading-relaxed text-g400 sm:px-2">
            기준: 발간일(이후 첫 거래일) 종가 → {HORIZON_LABEL[h]}(거래일 기준) 뒤 종가, 수정주가·배당 미포함. 초과수익 = 종목 수익률 − 같은 기간 소속
            시장 지수 수익률. 표본 {MIN_N}건 미만은 순위에서 빠지고, 기간이 안 찬 최근 리포트는 해당 기간 집계에서 빠져요. 과거 성과가 미래 수익을
            보장하지 않아요. · 채점{" "}
            <span className="num">
              {data.coverage.scored.toLocaleString()}/{data.coverage.reports.toLocaleString()}
            </span>
            건 · 갱신 {new Date(data.generatedAt).toLocaleString("ko-KR")}
          </p>
        </>
      )}
    </div>
  );
}
