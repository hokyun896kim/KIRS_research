"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Report, ExtractResponse } from "@/lib/types";
import AnalystCard from "./AnalystCard";
import { SectionTitle, SectorPill } from "./ui";
import BriefCard from "./BriefCard";
import { PROFILES } from "@/lib/profiles";

type Mode = "full" | "trade" | "counter" | "compare";

const MODE_META: Record<Mode, { title: string; sub: string; icon: string }> = {
  full: { title: "풀모드", sub: "모듈 1~5 · 확신도 · 상승여력", icon: "🧭" },
  trade: { title: "매매모드", sub: "+ 모듈 6 · 웹검색 현재가", icon: "💹" },
  counter: { title: "반론모드", sub: "반대 렌즈로 재검증", icon: "🥊" },
  compare: { title: "비교모드", sub: "이전 리포트 대비 변화", icon: "🔁" },
};

// 같은 종목의 이전 리포트: 발간일이 빠르거나, 같은 날이면 번호가 작은 것
function olderThan(list: Report[], cur: Report): Report[] {
  return list.filter(
    (r) =>
      r.pdfUrl &&
      (r.date < cur.date ||
        (r.date === cur.date &&
          r.no !== cur.no &&
          Number(r.no) < Number(cur.no))),
  );
}

export default function ReportDetail({
  report,
  onClose,
  onOpenReport,
}: {
  report: Report;
  onClose: () => void;
  onOpenReport?: (r: Report) => void;
}) {
  const [data, setData] = useState<ExtractResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("full");
  const [lensLoading, setLensLoading] = useState(false);

  // 종목 이력 · 비교모드
  const [history, setHistory] = useState<Report[] | null>(null);
  const [historyErr, setHistoryErr] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [prevNo, setPrevNo] = useState<string | null>(null);
  const [comparePrompt, setComparePrompt] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [tab, setTab] = useState<"prompt" | "ai">("ai");
  const [copied, setCopied] = useState(false);

  // AI 자동분석 상태
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    setData(null);
    setAiText("");
    setAiErr(null);
    if (!report.pdfUrl) {
      setErr("이 보고서에는 PDF 첨부가 없습니다.");
      setLoading(false);
      return;
    }
    const qs = new URLSearchParams({
      url: report.pdfUrl,
      name: report.name,
      code: report.code ?? "",
      title: report.title,
      date: report.date,
      author: report.author,
    });
    fetch(`/api/extract?${qs.toString()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as ExtractResponse;
      })
      .then((j) => alive && setData(j))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [report]);

  // 모드가 바뀌면 이전 AI 결과는 무효
  useEffect(() => {
    setAiText("");
    setAiErr(null);
    abortRef.current?.abort();
    setAiLoading(false);
  }, [mode, prevNo]);

  // 종목 이력 (전체 목록 색인에서 같은 종목) — 첫 조회는 색인 생성으로 20초쯤 걸릴 수 있음
  useEffect(() => {
    let alive = true;
    setHistory(null);
    setHistoryErr(null);
    setPrevNo(null);
    setComparePrompt(null);
    setShowAllHistory(false);
    const qs = new URLSearchParams({
      code: report.code ?? "",
      name: report.name,
    });
    fetch(`/api/history?${qs.toString()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j.reports as Report[];
      })
      .then((list) => {
        if (!alive) return;
        setHistory(list);
        setPrevNo(olderThan(list, report)[0]?.no ?? null);
      })
      .catch((e) => alive && setHistoryErr(e.message));
    return () => {
      alive = false;
    };
  }, [report]);

  const olderReports = history ? olderThan(history, report) : [];
  const prevReport = olderReports.find((r) => r.no === prevNo) ?? null;

  // 비교모드 복사용 프롬프트는 비교모드를 열 때만 받는다 (PDF 두 개를 받아야 해서)
  useEffect(() => {
    if (mode !== "compare" || !prevReport?.pdfUrl || !report.pdfUrl) return;
    let alive = true;
    setComparePrompt(null);
    setCompareLoading(true);
    const qs = new URLSearchParams({
      url: report.pdfUrl,
      name: report.name,
      code: report.code ?? "",
      title: report.title,
      date: report.date,
      author: report.author,
      prevUrl: prevReport.pdfUrl,
      prevName: prevReport.name,
      prevCode: prevReport.code ?? "",
      prevTitle: prevReport.title,
      prevDate: prevReport.date,
      prevAuthor: prevReport.author,
    });
    fetch(`/api/compare?${qs.toString()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j.promptCompare as string;
      })
      .then((p) => alive && setComparePrompt(p))
      .catch((e) => alive && setAiErr(e.message))
      .finally(() => alive && setCompareLoading(false));
    return () => {
      alive = false;
    };
    // prevReport는 history·prevNo에서 파생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, prevNo, history, report]);

  // 반론 렌즈를 바꾸면 해당 렌즈의 반론 프롬프트만 다시 받아온다
  async function changeLens(name: string) {
    if (!report.pdfUrl || !data || name === data.counterLens.name) return;
    setLensLoading(true);
    setAiText("");
    setAiErr(null);
    try {
      const qs = new URLSearchParams({
        url: report.pdfUrl,
        name: report.name,
        code: report.code ?? "",
        title: report.title,
        date: report.date,
        author: report.author,
        lens: name,
      });
      const r = await fetch(`/api/extract?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setData((d) =>
        d
          ? { ...d, counterLens: j.counterLens, promptCounter: j.promptCounter }
          : d,
      );
    } catch (e) {
      setAiErr((e as Error).message);
    } finally {
      setLensLoading(false);
    }
  }

  const prompt = data
    ? mode === "full"
      ? data.promptFull
      : mode === "trade"
        ? data.promptTrade
        : mode === "counter"
          ? data.promptCounter
          : (comparePrompt ?? "")
    : "";

  async function copy() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function copyAndOpen(target: "chatgpt" | "claude") {
    await copy();
    window.open(
      target === "chatgpt" ? "https://chatgpt.com/" : "https://claude.ai/new",
      "_blank",
      "noopener",
    );
  }

  async function runAi() {
    if (!report.pdfUrl) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAiLoading(true);
    setAiErr(null);
    setAiText("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          no: report.no,
          url: report.pdfUrl,
          name: report.name,
          code: report.code,
          title: report.title,
          date: report.date,
          author: report.author,
          mode,
          ...(mode === "counter" && data
            ? { lens: data.counterLens.name }
            : {}),
          ...(mode === "compare" && prevReport
            ? { prev: { ...prevReport, url: prevReport.pdfUrl } }
            : {}),
        }),
      });
      setAiModel(res.headers.get("X-Analyze-Model"));
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        if (j.error === "NO_API_KEY") {
          setAiErr(
            "서버에 ANTHROPIC_API_KEY가 없어요. Vercel 프로젝트 → Settings → Environment Variables 에 추가하면 자동분석이 켜집니다.",
          );
        } else {
          setAiErr(j.message || j.error || `HTTP ${res.status}`);
        }
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setAiText(acc);
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError")
        setAiErr((e as Error).message || "분석 실패");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-3xl animate-drawer-in flex-col bg-[#f6f7f9] shadow-pop">
        {/* 헤더 */}
        <header className="flex-none border-b border-slate-200/80 bg-white px-5 pb-4 pt-4 sm:px-7 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                {data?.sector && <SectorPill sector={data.sector} />}
                {report.code && <span className="num">{report.code}</span>}
                <span>·</span>
                <span>
                  {report.author} · <span className="num">{report.date}</span>
                </span>
              </div>
              <h2 className="mt-1.5 truncate text-[24px] font-extrabold tracking-tight text-slate-900">
                {report.name}
              </h2>
              <p className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-slate-600">
                {report.title}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
          <BriefCard report={report} />

          {loading && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-5 py-6 text-sm text-slate-500 shadow-card">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
              PDF 본문 추출 + 애널리스트 매칭 중…
            </div>
          )}

          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {err}
              {report.pdfUrl && (
                <a
                  href={report.pdfUrl}
                  target="_blank"
                  rel="noopener"
                  className="ml-2 font-semibold underline"
                >
                  원본 PDF 열기
                </a>
              )}
            </div>
          )}

          {data && (
            <>
              {/* 작성 애널 렌즈 */}
              <section>
                <SectionTitle
                  icon="🔎"
                  right={
                    <span className="num flex flex-wrap justify-end gap-x-2 text-xs text-slate-400">
                      <span>📄 {data.pages ?? "?"}p</span>
                      <span>본문 {data.textLength.toLocaleString()}자</span>
                      {report.pdfUrl && (
                        <a
                          href={report.pdfUrl}
                          target="_blank"
                          rel="noopener"
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          원본 PDF ↗
                        </a>
                      )}
                    </span>
                  }
                >
                  작성 애널 렌즈
                </SectionTitle>
                <div className="space-y-3">
                  {data.profile ? (
                    <AnalystCard p={data.profile} role="주렌즈" collapsible />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                      DB 미등록 애널({data.analyst ?? "미상"}) — 지침 STEP 0.2에
                      따라 임시 프로파일을 추정합니다.
                    </div>
                  )}
                  {data.raProfile && (
                    <AnalystCard
                      p={data.raProfile}
                      role="보조렌즈(RA)"
                      collapsible
                    />
                  )}
                </div>
              </section>

              {/* 종목 리포트 이력 */}
              <section>
                <SectionTitle
                  icon="📚"
                  right={
                    history &&
                    history.length > 4 && (
                      <button
                        onClick={() => setShowAllHistory((v) => !v)}
                        className="text-xs font-medium text-slate-400 hover:text-slate-700"
                      >
                        {showAllHistory ? "접기" : `전체 ${history.length}건`}
                      </button>
                    )
                  }
                >
                  이 종목 KIRS 리포트 이력
                  {history ? ` ${history.length}건` : ""}
                </SectionTitle>
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
                  {!history && !historyErr && (
                    <div className="text-xs text-slate-400">
                      전체 목록에서 같은 종목을 찾는 중… (처음엔 20초쯤 걸려요)
                    </div>
                  )}
                  {historyErr && (
                    <div className="text-xs text-red-500">
                      이력을 불러오지 못했어요: {historyErr}
                    </div>
                  )}
                  {history && (
                    <ol className="relative space-y-3 border-l-2 border-slate-100 pl-4">
                      {(showAllHistory ? history : history.slice(0, 4)).map(
                        (r) => {
                          const isCur = r.no === report.no;
                          return (
                            <li key={`${r.no}-${r.date}`} className="relative">
                              <span
                                className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                                  isCur ? "bg-indigo-500" : "bg-slate-300"
                                }`}
                              />
                              <div className="num text-[11px] text-slate-400">
                                {r.date} · {r.author}
                              </div>
                              {isCur || !onOpenReport ? (
                                <div
                                  className={`text-[13.5px] leading-snug ${isCur ? "font-semibold text-slate-900" : "text-slate-600"}`}
                                >
                                  {r.title}
                                  {isCur && (
                                    <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-px text-[11px] font-semibold text-indigo-600">
                                      지금 보는 리포트
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => onOpenReport(r)}
                                  className="text-left text-[13.5px] leading-snug text-slate-600 hover:text-indigo-700 hover:underline"
                                >
                                  {r.title}
                                </button>
                              )}
                            </li>
                          );
                        },
                      )}
                    </ol>
                  )}
                </div>
              </section>

              {/* 분석 도구 */}
              <section>
                <SectionTitle icon="🛠">분석 도구</SectionTitle>
                <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card sm:p-5">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(["full", "trade", "counter", "compare"] as const).map(
                      (m) => {
                        const meta = MODE_META[m];
                        const disabled =
                          m === "compare" && olderReports.length === 0;
                        const on = mode === m;
                        return (
                          <button
                            key={m}
                            onClick={() => setMode(m)}
                            disabled={disabled}
                            title={
                              disabled
                                ? "이 종목의 이전 리포트가 없어요"
                                : undefined
                            }
                            className={`rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              on
                                ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-100"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div
                              className={`text-[14px] font-bold ${on ? "text-indigo-700" : "text-slate-800"}`}
                            >
                              <span className="mr-1">{meta.icon}</span>
                              {meta.title}
                            </div>
                            <div className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                              {meta.sub}
                            </div>
                          </button>
                        );
                      },
                    )}
                  </div>

                  {mode === "counter" && (
                    <div className="mt-3 space-y-2.5 rounded-xl bg-rose-50/70 p-3.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-rose-800">
                          반론 렌즈
                        </span>
                        <select
                          value={data.counterLens.name}
                          disabled={lensLoading}
                          onChange={(e) => changeLens(e.target.value)}
                          className="h-9 rounded-lg border border-rose-200 bg-white px-2 text-sm font-medium"
                        >
                          {PROFILES.filter(
                            (p) => p.name !== data.profile?.name,
                          ).map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} · {p.type}
                            </option>
                          ))}
                        </select>
                        {lensLoading && (
                          <span className="text-xs text-rose-500">
                            프롬프트 다시 만드는 중…
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-rose-700/80">
                        작성 애널과 논리가 정반대인 애널이 기본으로 골라져요.
                        같은 리포트를 그 애널이 읽었다면 무엇을 의심할지 봅니다.
                      </p>
                      <AnalystCard
                        p={data.counterLens}
                        role="반론 렌즈"
                        collapsible
                      />
                    </div>
                  )}

                  {mode === "compare" && (
                    <div className="mt-3 space-y-2 rounded-xl bg-teal-50/70 p-3.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-teal-800">
                          비교할 이전 리포트
                        </span>
                        <select
                          value={prevNo ?? ""}
                          onChange={(e) => setPrevNo(e.target.value)}
                          className="h-9 max-w-full rounded-lg border border-teal-200 bg-white px-2 text-sm font-medium"
                        >
                          {olderReports.map((r) => (
                            <option
                              key={`${r.no}-${r.date}`}
                              value={r.no ?? ""}
                            >
                              {r.date} · {r.author} · {r.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs leading-relaxed text-teal-700/80">
                        추정치 변화, 이전 리포트 예측이 맞았는지 채점, 새로
                        생기거나 사라진 논리, 톤 변화와 말 바뀜을 봅니다.
                      </p>
                    </div>
                  )}

                  {/* 탭 */}
                  <div className="mt-4 inline-flex rounded-xl bg-slate-100 p-1 text-sm">
                    {(["ai", "prompt"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`rounded-lg px-4 py-1.5 font-semibold transition ${
                          tab === t
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {t === "prompt" ? "📋 프롬프트 복붙" : "✨ AI 자동분석"}
                      </button>
                    ))}
                  </div>

                  {tab === "prompt" && (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={copy}
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                          {copied ? "✓ 복사됨" : "프롬프트 복사"}
                        </button>
                        <button
                          onClick={() => copyAndOpen("chatgpt")}
                          className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          복사 후 ChatGPT ↗
                        </button>
                        <button
                          onClick={() => copyAndOpen("claude")}
                          className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          복사 후 Claude ↗
                        </button>
                      </div>
                      <div>
                        <div className="num mb-1.5 text-xs font-medium text-slate-500">
                          {mode === "compare" && compareLoading
                            ? "두 리포트 PDF를 읽어 비교 프롬프트를 만드는 중…"
                            : `완성 프롬프트 (${mode === "compare" ? "두 리포트 본문" : "지침 + 프로파일 + PDF본문"}, ${prompt.length.toLocaleString()}자)`}
                        </div>
                        <textarea
                          readOnly
                          value={prompt}
                          className="h-64 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-[11.5px] leading-relaxed text-slate-700 outline-none focus:border-indigo-300"
                        />
                      </div>
                    </div>
                  )}

                  {tab === "ai" && (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={runAi}
                          disabled={aiLoading}
                          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                        >
                          {aiLoading
                            ? "분석 중…"
                            : aiText
                              ? "다시 분석"
                              : `${MODE_META[mode].title} AI 분석 시작`}
                        </button>
                        {aiLoading && (
                          <button
                            onClick={() => abortRef.current?.abort()}
                            className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            중지
                          </button>
                        )}
                        <span className="text-xs text-slate-400">
                          {mode === "trade"
                            ? "웹검색으로 최신가 보강"
                            : mode === "counter"
                              ? `${data.counterLens.name} 렌즈로 재검증`
                              : mode === "compare"
                                ? `${prevReport?.date ?? "?"} 리포트 대비`
                                : "모듈 1~5 + 확신도·상승여력"}
                          {aiModel ? ` · ${aiModel}` : ""}
                        </span>
                      </div>

                      {!aiText && !aiLoading && !aiErr && (
                        <p className="rounded-xl bg-slate-50 p-3.5 text-[13px] leading-relaxed text-slate-500">
                          버튼을 누르면 PDF 원본(표·차트 포함)을 직접 읽고, 작성
                          애널 렌즈 분석에 더해 확신도(필독/참고/패스)와 내재
                          상승여력까지 보여줘요. 복사·붙여넣기가 필요 없어요.
                          (호출당 소액 비용 발생)
                        </p>
                      )}

                      {aiErr && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
                          {aiErr}
                        </div>
                      )}

                      {aiLoading && !aiText && (
                        <div className="flex items-center gap-2 rounded-xl bg-violet-50 p-3.5 text-[13px] text-violet-700">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                          PDF 원본(표·차트 포함)을 읽는 중… 첫 글자까지 10~30초
                          걸릴 수 있어요.
                        </div>
                      )}

                      {aiText && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                          <div className="md">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {aiText}
                            </ReactMarkdown>
                          </div>
                          {aiLoading && (
                            <span className="mt-2 inline-block h-3 w-3 animate-pulse rounded-full bg-violet-400 align-middle" />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
