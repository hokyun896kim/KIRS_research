"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Report, ExtractResponse, BriefsResponse, AnalystSummary } from "@/lib/types";
import AnalystCard, { MIN_TRACK_N } from "./AnalystCard";
import { Avatar, CompanyMark, Spinner, pct, retTone } from "./ui";
import { BriefBody, BriefHero, useBrief } from "./BriefCard";
import { PROFILES, matchProfile } from "@/lib/profiles";
import { classifySector } from "@/lib/sector";

type Mode = "full" | "trade" | "counter" | "compare";

const MODE_META: Record<Mode, { title: string; sub: string }> = {
  full: { title: "풀모드", sub: "애널 렌즈 분석 · 확신도 · 상승여력 역산" },
  trade: { title: "매매모드", sub: "풀모드 + 현재가·밸류 웹검색" },
  counter: { title: "반론모드", sub: "정반대 성향 애널 눈으로 재검증" },
  compare: { title: "비교모드", sub: "이전 리포트와 무엇이 달라졌나" },
};

type View = "brief" | "lens" | "history" | "ai";

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
  const [showPrompt, setShowPrompt] = useState(false);
  const [view, setView] = useState<View>("brief");
  const [track, setTrack] = useState<Record<string, AnalystSummary>>({});
  const brief = useBrief(report);
  const sector = classifySector(report.name, report.title);
  const authorProfile = matchProfile(report.author);
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

  // 애널별 6개월 성과 (목록과 같은 API, CDN 캐시)
  useEffect(() => {
    if (!report.no) return;
    let alive = true;
    fetch(`/api/briefs?nos=${report.no}`)
      .then((r) => (r.ok ? (r.json() as Promise<BriefsResponse>) : null))
      .then((j) => alive && j && setTrack(j.analysts))
      .catch(() => {});
    return () => {
      alive = false;
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

  const authorTrack = track[report.author]?.n6 >= MIN_TRACK_N ? track[report.author] : undefined;
  const VIEWS: { key: View; label: string }[] = [
    { key: "brief", label: "브리핑" },
    { key: "lens", label: "애널 렌즈" },
    { key: "history", label: history ? `이력 ${history.length}` : "이력" },
    { key: "ai", label: "AI 분석" },
  ];

  const extractState = loading ? (
    <div className="flex items-center gap-2.5 py-10 text-[15px] text-g500">
      <Spinner /> PDF 본문을 읽고 애널리스트를 찾는 중이에요
    </div>
  ) : err ? (
    <div className="rounded-2xl bg-g50 p-4 text-[15px] text-g700">
      {err}
      {report.pdfUrl && (
        <a href={report.pdfUrl} target="_blank" rel="noopener" className="ml-2 font-semibold text-tb">
          원본 PDF 열기
        </a>
      )}
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 hidden animate-fade-in bg-black/40 sm:block" onClick={onClose} />
      <aside className="relative flex h-full w-full animate-sheet-in flex-col overflow-y-auto overscroll-contain bg-g100 sm:max-w-[680px] sm:animate-drawer-in">
        {/* 상단 바 */}
        <div className="sticky top-0 z-20 flex h-14 flex-none items-center justify-between bg-white px-2 sm:px-4">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid h-10 w-10 place-items-center rounded-full text-g800 hover:bg-g100"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
              <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {report.pdfUrl && (
            <a
              href={report.pdfUrl}
              target="_blank"
              rel="noopener"
              className="rounded-lg px-3 py-2 text-[14px] font-semibold text-g600 hover:bg-g100"
            >
              원본 PDF
            </a>
          )}
        </div>

        {/* 종목 · 요약 */}
        <section className="bg-white px-5 pb-6 pt-1 sm:px-7">
          <div className="flex items-center gap-3.5">
            <CompanyMark name={report.name} sector={sector} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-[24px] font-bold tracking-tight text-g900">{report.name}</h2>
              <div className="num mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[14px] text-g500">
                {report.code && <span>{report.code}</span>}
                {sector.key !== "etc" && <span>· {sector.label}</span>}
                <span>· {report.date.replaceAll("-", ".")}</span>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[17px] font-semibold leading-snug text-g800">{report.title}</p>
          <div className="mt-3 flex items-center gap-2 text-[14px] text-g600">
            <Avatar name={report.author} stance={authorProfile?.stance} size="xs" />
            <span className="font-semibold text-g800">{report.author}</span>
            {authorProfile && <span className="truncate text-g500">{authorProfile.type}</span>}
            {authorTrack && (
              <span className="num ml-auto shrink-0 text-[13px] text-g500">
                6개월 <span className={`font-semibold ${retTone(authorTrack.avg6)}`}>{pct(authorTrack.avg6)}</span> · 승률{" "}
                {(authorTrack.win6 * 100).toFixed(0)}%
              </span>
            )}
          </div>
          {brief.enabled && (
            <div className="mt-5">
              <BriefHero res={brief.res} err={brief.err} />
            </div>
          )}
        </section>

        {/* 탭 */}
        <div className="sticky top-14 z-10 mt-2.5 flex-none border-b border-g100 bg-white px-2 sm:px-4">
          <div className="flex">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`relative h-12 flex-1 text-[15px] font-semibold transition ${
                  view === v.key ? "text-g900" : "text-g500 hover:text-g700"
                }`}
              >
                {v.label}
                {view === v.key && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-g900" />}
              </button>
            ))}
          </div>
        </div>

        <section className="min-h-[60vh] flex-1 bg-white px-5 py-6 sm:px-7">
          {/* 브리핑 */}
          {view === "brief" &&
            (brief.res ? (
              <BriefBody res={brief.res} />
            ) : brief.err || !brief.enabled ? (
              <p className="py-10 text-center text-[15px] text-g500">브리핑이 없어요. AI 분석 탭에서 직접 분석할 수 있어요.</p>
            ) : (
              <div className="space-y-3 py-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-g100" style={{ width: `${92 - i * 14}%` }} />
                ))}
              </div>
            ))}

          {/* 애널 렌즈 */}
          {view === "lens" &&
            (extractState ??
              (data && (
                <div className="space-y-3">
                  {data.profile ? (
                    <AnalystCard p={data.profile} role="주렌즈 · 작성 애널" />
                  ) : (
                    <div className="rounded-2xl bg-g50 p-4 text-[15px] text-g700">
                      도감에 없는 애널({data.analyst ?? "미상"})이에요. 분석 때는 문체로 가장 가까운 유형을 추정해 임시 프로필을 만들어요.
                    </div>
                  )}
                  {data.raProfile && <AnalystCard p={data.raProfile} role="보조렌즈 · RA" collapsible />}
                  <p className="num pt-1 text-[13px] text-g400">
                    PDF {data.pages ?? "?"}쪽 · 본문 {data.textLength.toLocaleString()}자
                  </p>
                </div>
              )))}

          {/* 이력 */}
          {view === "history" && (
            <div>
              {!history && !historyErr && (
                <div className="flex items-center gap-2.5 py-10 text-[15px] text-g500">
                  <Spinner /> 같은 종목의 KIRS 리포트를 찾는 중이에요
                </div>
              )}
              {historyErr && <p className="py-10 text-[15px] text-g600">이력을 불러오지 못했어요. {historyErr}</p>}
              {history && (
                <ol>
                  {(showAllHistory ? history : history.slice(0, 8)).map((r) => {
                    const isCur = r.no === report.no;
                    const body = (
                      <>
                        <div className="num text-[13px] text-g500">
                          {r.date.replaceAll("-", ".")} · {r.author}
                        </div>
                        <div className={`mt-1 text-[16px] leading-snug ${isCur ? "font-bold text-g900" : "font-medium text-g800"}`}>
                          {r.title}
                        </div>
                        {isCur && <span className="mt-1.5 inline-block rounded-md bg-tb-50 px-1.5 py-0.5 text-[12px] font-bold text-tb">지금 보는 리포트</span>}
                      </>
                    );
                    return (
                      <li key={`${r.no}-${r.date}`} className="border-b border-g100 last:border-0">
                        {isCur || !onOpenReport ? (
                          <div className="px-1 py-4">{body}</div>
                        ) : (
                          <button onClick={() => onOpenReport(r)} className="press block w-full rounded-xl px-1 py-4 text-left hover:bg-g50">
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {history && history.length > 8 && (
                <button
                  onClick={() => setShowAllHistory((v) => !v)}
                  className="press mt-3 h-11 w-full rounded-xl bg-g100 text-[14px] font-semibold text-g700"
                >
                  {showAllHistory ? "접기" : `${history.length}건 모두 보기`}
                </button>
              )}
            </div>
          )}

          {/* AI 분석 */}
          {view === "ai" &&
            (extractState ??
              (data && (
                <div>
                  <h3 className="text-[20px] font-bold tracking-tight text-g900">AI에게 깊게 맡기기</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-g600">
                    PDF 원본을 표·차트까지 직접 읽고 분석해요. 보통 1~2분 걸리고, 호출마다 소액의 비용이 들어요.
                  </p>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {(["full", "trade", "counter", "compare"] as const).map((m) => {
                      const meta = MODE_META[m];
                      const disabled = m === "compare" && olderReports.length === 0;
                      const on = mode === m;
                      return (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          disabled={disabled}
                          title={disabled ? "이 종목의 이전 리포트가 없어요" : undefined}
                          className={`press flex items-center gap-3 rounded-2xl p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            on ? "bg-tb-50 ring-2 ring-tb" : "bg-g50 hover:bg-g100"
                          }`}
                        >
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-tb" : "border-g300"}`}
                          >
                            {on && <span className="h-2.5 w-2.5 rounded-full bg-tb" />}
                          </span>
                          <span className="min-w-0">
                            <span className={`block text-[16px] font-semibold ${on ? "text-tb-600" : "text-g900"}`}>{meta.title}</span>
                            <span className="mt-0.5 block text-[13px] leading-snug text-g500">{meta.sub}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {mode === "counter" && (
                    <div className="mt-4 space-y-3">
                      <label className="flex items-center gap-3 rounded-2xl bg-g50 px-4 py-3">
                        <span className="shrink-0 text-[14px] font-semibold text-g700">반론 렌즈</span>
                        <select
                          value={data.counterLens.name}
                          disabled={lensLoading}
                          onChange={(e) => changeLens(e.target.value)}
                          className="h-10 min-w-0 flex-1 cursor-pointer rounded-xl bg-white px-3 text-[15px] font-medium text-g900 outline-none"
                        >
                          {PROFILES.filter((p) => p.name !== data.profile?.name).map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} · {p.type}
                            </option>
                          ))}
                        </select>
                        {lensLoading && <Spinner />}
                      </label>
                      <AnalystCard p={data.counterLens} role="이 사람 눈으로 다시 읽어요" collapsible />
                    </div>
                  )}

                  {mode === "compare" && (
                    <label className="mt-4 flex flex-col gap-2 rounded-2xl bg-g50 px-4 py-3">
                      <span className="text-[14px] font-semibold text-g700">비교할 이전 리포트</span>
                      <select
                        value={prevNo ?? ""}
                        onChange={(e) => setPrevNo(e.target.value)}
                        className="h-11 w-full cursor-pointer rounded-xl bg-white px-3 text-[15px] font-medium text-g900 outline-none"
                      >
                        {olderReports.map((r) => (
                          <option key={`${r.no}-${r.date}`} value={r.no ?? ""}>
                            {r.date} · {r.author} · {r.title}
                          </option>
                        ))}
                      </select>
                      <span className="text-[13px] leading-relaxed text-g500">
                        추정치 변화, 이전 예측 채점, 새로 생기거나 사라진 논리, 톤 변화를 봐요.
                      </span>
                    </label>
                  )}

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={runAi}
                      disabled={aiLoading}
                      className="press h-14 flex-1 rounded-2xl bg-tb text-[17px] font-semibold text-white hover:bg-tb-600 disabled:opacity-60"
                    >
                      {aiLoading ? "분석하고 있어요…" : aiText ? "다시 분석하기" : `${MODE_META[mode].title}로 분석하기`}
                    </button>
                    {aiLoading && (
                      <button
                        onClick={() => abortRef.current?.abort()}
                        className="press h-14 shrink-0 rounded-2xl bg-g100 px-5 text-[16px] font-semibold text-g700"
                      >
                        중지
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowPrompt((v) => !v)}
                    className="mt-2 h-11 w-full rounded-xl text-[14px] font-semibold text-g600 hover:bg-g50"
                  >
                    {showPrompt ? "프롬프트 닫기" : "프롬프트만 복사해서 ChatGPT·Claude에서 쓰기"}
                  </button>

                  {showPrompt && (
                    <div className="mt-2 space-y-3 rounded-2xl bg-g50 p-4">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={copy} className="press h-11 rounded-xl bg-g800 px-4 text-[14px] font-semibold text-white">
                          {copied ? "복사했어요" : "프롬프트 복사"}
                        </button>
                        <button
                          onClick={() => copyAndOpen("chatgpt")}
                          className="press h-11 rounded-xl bg-white px-4 text-[14px] font-semibold text-g700 ring-1 ring-g200"
                        >
                          복사하고 ChatGPT 열기
                        </button>
                        <button
                          onClick={() => copyAndOpen("claude")}
                          className="press h-11 rounded-xl bg-white px-4 text-[14px] font-semibold text-g700 ring-1 ring-g200"
                        >
                          복사하고 Claude 열기
                        </button>
                      </div>
                      <div className="num text-[13px] text-g500">
                        {mode === "compare" && compareLoading
                          ? "두 리포트 PDF를 읽어 비교 프롬프트를 만드는 중이에요"
                          : `완성 프롬프트 ${prompt.length.toLocaleString()}자`}
                      </div>
                      <textarea
                        readOnly
                        value={prompt}
                        className="h-56 w-full resize-y rounded-xl bg-white p-3.5 font-mono text-[12px] leading-relaxed text-g700 outline-none ring-1 ring-g200"
                      />
                    </div>
                  )}

                  {aiErr && <div className="mt-4 rounded-2xl bg-to-50 p-4 text-[15px] text-orange-800">{aiErr}</div>}

                  {aiLoading && !aiText && (
                    <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-g50 p-4 text-[15px] text-g600">
                      <Spinner /> PDF 원본을 읽고 있어요. 첫 글자까지 10초쯤 걸려요.
                    </div>
                  )}

                  {aiText && (
                    <div className="mt-6 border-t border-g100 pt-6">
                      <div className="md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiText}</ReactMarkdown>
                      </div>
                      {aiLoading && <span className="mt-2 inline-block h-3 w-3 animate-pulse rounded-full bg-tb align-middle" />}
                      {aiModel && !aiLoading && <p className="mt-4 text-[12px] text-g400">{aiModel}</p>}
                    </div>
                  )}
                </div>
              )))}
        </section>
      </aside>
    </div>
  );
}
