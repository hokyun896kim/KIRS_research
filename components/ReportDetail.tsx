"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Report, ExtractResponse } from "@/lib/types";
import AnalystCard from "./AnalystCard";
import { PROFILES } from "@/lib/profiles";

type Mode = "full" | "trade" | "counter";

const MODE_LABEL: Record<Mode, string> = {
  full: "풀모드 (모듈 1~5·7·8)",
  trade: "매매모드 (+모듈 6·웹검색)",
  counter: "반론모드 (반대 렌즈)",
};

export default function ReportDetail({ report, onClose }: { report: Report; onClose: () => void }) {
  const [data, setData] = useState<ExtractResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("full");
  const [lensLoading, setLensLoading] = useState(false);
  const [tab, setTab] = useState<"prompt" | "ai">("prompt");
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
  }, [mode]);

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
      setData((d) => (d ? { ...d, counterLens: j.counterLens, promptCounter: j.promptCounter } : d));
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
        : data.promptCounter
    : "";

  async function copy() {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function copyAndOpen(target: "chatgpt" | "claude") {
    await copy();
    window.open(target === "chatgpt" ? "https://chatgpt.com/" : "https://claude.ai/new", "_blank", "noopener");
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
          url: report.pdfUrl,
          name: report.name,
          code: report.code,
          title: report.title,
          date: report.date,
          author: report.author,
          mode,
          ...(mode === "counter" && data ? { lens: data.counterLens.name } : {}),
        }),
      });
      setAiModel(res.headers.get("X-Analyze-Model"));
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        if (j.error === "NO_API_KEY") {
          setAiErr(
            "서버에 ANTHROPIC_API_KEY가 없어요. Vercel 프로젝트 → Settings → Environment Variables 에 추가하면 자동분석이 켜집니다."
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
      if ((e as Error)?.name !== "AbortError") setAiErr((e as Error).message || "분석 실패");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-lg font-bold">
              <span className="truncate">{report.name}</span>
              {report.code && <span className="text-sm font-normal text-slate-400">{report.code}</span>}
              {data?.sector && (
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${data.sector.color}`}>
                  {data.sector.label}
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-sm text-slate-600">{report.title}</div>
            <div className="mt-1 text-xs text-slate-400">
              {report.author} · {report.date}
            </div>
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
              PDF 본문 추출 + 애널리스트 매칭 중…
            </div>
          )}

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
              {report.pdfUrl && (
                <a href={report.pdfUrl} target="_blank" rel="noopener" className="ml-2 underline">
                  원본 PDF 열기
                </a>
              )}
            </div>
          )}

          {data && (
            <>
              {data.profile ? (
                <AnalystCard p={data.profile} role="주렌즈" />
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  DB 미등록 애널({data.analyst ?? "미상"}) — 지침 STEP 0.2에 따라 임시 프로파일을 추정합니다.
                </div>
              )}
              {data.raProfile && <AnalystCard p={data.raProfile} role="보조렌즈(RA)" />}

              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <span>📄 {data.pages ?? "?"}p</span>
                <span>· 본문 {data.textLength.toLocaleString()}자</span>
                {data.analyst && <span>· Analyst {data.analyst}</span>}
                {data.ra && <span>· RA {data.ra}</span>}
              </div>

              {/* 모드 선택 */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm">
                {(["full", "trade", "counter"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                      mode === m ? "bg-white text-slate-900 shadow" : "text-slate-500"
                    }`}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>

              {/* 반론 렌즈 선택 */}
              {mode === "counter" && (
                <div className="space-y-2 rounded-lg border border-rose-100 bg-rose-50/50 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-rose-800">반론 렌즈</span>
                    <select
                      value={data.counterLens.name}
                      disabled={lensLoading}
                      onChange={(e) => changeLens(e.target.value)}
                      className="rounded-md border border-rose-200 bg-white px-2 py-1 text-sm"
                    >
                      {PROFILES.filter((p) => p.name !== data.profile?.name).map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} · {p.type}
                        </option>
                      ))}
                    </select>
                    {lensLoading && <span className="text-xs text-rose-500">프롬프트 다시 만드는 중…</span>}
                  </div>
                  <p className="text-xs text-rose-700/80">
                    작성 애널과 논리가 정반대인 애널이 기본으로 골라져요. 같은 리포트를 그 애널이 읽었다면 무엇을 의심할지 봅니다.
                  </p>
                  <AnalystCard p={data.counterLens} role="반론 렌즈" />
                </div>
              )}

              {/* 탭 */}
              <div className="flex gap-4 border-b border-slate-200 text-sm">
                {(["prompt", "ai"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`-mb-px border-b-2 px-1 pb-2 font-medium transition ${
                      tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {t === "prompt" ? "프롬프트 (복붙)" : "AI 자동분석 ✨"}
                  </button>
                ))}
              </div>

              {tab === "prompt" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={copy}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      {copied ? "✓ 복사됨" : "프롬프트 복사"}
                    </button>
                    <button
                      onClick={() => copyAndOpen("chatgpt")}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                    >
                      복사 후 ChatGPT 열기 ↗
                    </button>
                    <button
                      onClick={() => copyAndOpen("claude")}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                    >
                      복사 후 Claude 열기 ↗
                    </button>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">
                      완성 프롬프트 (지침 + 프로파일 + PDF본문, {prompt.length.toLocaleString()}자)
                    </div>
                    <textarea
                      readOnly
                      value={prompt}
                      className="h-64 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700"
                    />
                  </div>
                </div>
              )}

              {tab === "ai" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={runAi}
                      disabled={aiLoading}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {aiLoading ? "분석 중…" : aiText ? "다시 분석" : "AI 자동분석 시작"}
                    </button>
                    {aiLoading && (
                      <button
                        onClick={() => abortRef.current?.abort()}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        중지
                      </button>
                    )}
                    <span className="text-xs text-slate-400">
                      {mode === "trade"
                        ? "매매모드: 웹검색으로 최신가 보강"
                        : mode === "counter"
                          ? `반론모드: ${data.counterLens.name} 렌즈로 재검증`
                          : "풀모드: 모듈 1~5 + 확신도·상승여력"}
                      {aiModel ? ` · ${aiModel}` : ""}
                    </span>
                  </div>

                  {!aiText && !aiLoading && !aiErr && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                      버튼을 누르면 PDF 원본(표·차트 포함)을 직접 읽고, 작성 애널 렌즈 분석에 더해 확신도(필독/참고/패스)와
                      내재 상승여력까지 보여줘요. 복사·붙여넣기가 필요 없어요. (호출당 소액 비용 발생)
                    </p>
                  )}

                  {aiErr && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{aiErr}</div>
                  )}

                  {aiLoading && !aiText && (
                    <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs text-violet-700">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
                      PDF 원본(표·차트 포함)을 읽는 중… 첫 글자까지 10~30초 걸릴 수 있어요.
                    </div>
                  )}

                  {aiText && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiText}</ReactMarkdown>
                      </div>
                      {aiLoading && (
                        <span className="mt-2 inline-block h-3 w-3 animate-pulse rounded-full bg-violet-400 align-middle" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
