"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Report, ListResult } from "@/lib/types";
import { PROFILES, matchProfile } from "@/lib/profiles";
import { classifySector, ALL_SECTORS } from "@/lib/sector";
import { stanceDot } from "./AnalystCard";
import ReportDetail from "./ReportDetail";
import AnalystGuide from "./AnalystGuide";

function AuthorBadge({ author }: { author: string }) {
  const p = matchProfile(author);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${stanceDot(p?.stance)}`} />
      <span className="font-medium text-slate-700">{author}</span>
      {p && <span className="text-xs text-slate-400">{p.type}</span>}
    </span>
  );
}

export default function ReportList() {
  const [data, setData] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [area, setArea] = useState<"subject" | "worker" | "content" | "">("");
  const [keyword, setKeyword] = useState("");
  const [activeAnalyst, setActiveAnalyst] = useState<string | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [draftKeyword, setDraftKeyword] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("");
  const [showGuide, setShowGuide] = useState(false);

  const load = useCallback(()  => {
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({ page: String(page), area, keyword });
    fetch(`/api/reports?${qs.toString()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as ListResult;
      })
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [page, area, keyword]);

  function applySearch(a: typeof area, kw: string) {
    setActiveAnalyst(a === "worker" ? kw : null);
    setArea(a);
    setKeyword(kw);
    setPage(1);
  }

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = (data?.reports ?? []).map((r) => ({ r, sector: classifySector(r.name, r.title) }));
    return sectorFilter ? list.filter((x) => x.sector.key === sectorFilter) : list;
  }, [data, sectorFilter]);

  const pageCount = data?.pageCount ?? 1;
  const blockStart = Math.floor((page - 1) / 10) * 10 + 1;
  const blockEnd = Math.min(blockStart + 9, pageCount);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">KIRS 리포트 · 애널리스트별 분석기</h1>
          <p className="mt-1 text-sm text-slate-500">
            한국IR협의회 리포트를 <b>작성 애널리스트의 렌즈</b>로 해석합니다. 보고서를 누르면 프로파일·완성 프롬프트·
            <b>AI 자동분석</b>까지 한 번에.
          </p>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          📖 애널 도감
        </button>
      </header>

      {/* 애널리스트 빠른 필터 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => applySearch("", "")}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            !activeAnalyst && !keyword
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          전체
        </button>
        {PROFILES.map((p) => (
          <button
            key={p.name}
            onClick={() => applySearch("worker", p.name)}
            title={`${p.type} · ${p.guide}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
              activeAnalyst === p.name
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${stanceDot(p.stance)}`} />
            {p.name}
            {p.warn && "⚠"}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applySearch(area === "worker" ? "subject" : area || "subject", draftKeyword.trim());
        }}
        className="mb-4 flex flex-wrap gap-2"
      >
        <select
          value={area === "worker" ? "subject" : area || "subject"}
          onChange={(e) => setArea(e.target.value as typeof area)}
          className="rounded-lg border border-slate-300 bg-white px-2 text-sm"
        >
          <option value="subject">제목</option>
          <option value="content">내용</option>
        </select>
        <input
          value={draftKeyword}
          onChange={(e) => setDraftKeyword(e.target.value)}
          placeholder="종목·키워드 검색"
          className="min-w-40 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <button className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-900">검색</button>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          title="현재 페이지 내 섹터 필터"
          className="rounded-lg border border-slate-300 bg-white px-2 text-sm"
        >
          <option value="">섹터 전체</option>
          {ALL_SECTORS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </form>

      <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
        <span>
          {activeAnalyst && <span className="mr-2 font-medium text-blue-700">애널: {activeAnalyst}</span>}
          {keyword && !activeAnalyst && <span className="mr-2">“{keyword}” 검색</span>}
          {sectorFilter && <span className="mr-2 text-slate-400">· 섹터 필터(현재 페이지)</span>}
          전체 <b className="text-slate-700">{data?.total?.toLocaleString() ?? "—"}</b> 건
        </span>
        <span>
          {page} / {pageCount} 페이지
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="w-44 px-3 py-2 font-medium">종목</th>
              <th className="px-3 py-2 font-medium">제목</th>
              <th className="w-40 px-3 py-2 font-medium">애널리스트</th>
              <th className="w-24 px-3 py-2 font-medium">발간일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-3 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))}
            {!loading && err && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-red-600">
                  목록을 불러오지 못했습니다: {err}
                  <button onClick={load} className="ml-2 underline">
                    재시도
                  </button>
                </td>
              </tr>
            )}
            {!loading &&
              !err &&
              rows.map(({ r, sector }, i) => (
                <tr key={`${r.no}-${i}`} onClick={() => setSelected(r)} className="cursor-pointer hover:bg-blue-50/50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-900">{r.name}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {r.code && <span className="text-xs text-slate-400">{r.code}</span>}
                      <span className={`rounded border px-1.5 py-0 text-[11px] ${sector.color}`}>{sector.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{r.title}</td>
                  <td className="px-3 py-2.5">
                    <AuthorBadge author={r.author} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{r.date}</td>
                </tr>
              ))}
            {!loading && !err && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-slate-400">
                  {sectorFilter
                    ? "이 페이지엔 해당 섹터 리포트가 없어요. (섹터 필터는 현재 페이지 기준)"
                    : "결과가 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1 text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage(1)}
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            «
          </button>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            ‹
          </button>
          {Array.from({ length: blockEnd - blockStart + 1 }, (_, i) => blockStart + i).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`min-w-8 rounded px-2 py-1 ${
                n === page ? "bg-blue-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {n}
            </button>
          ))}
          <button
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            ›
          </button>
          <button
            disabled={page >= pageCount}
            onClick={() => setPage(pageCount)}
            className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            »
          </button>
        </div>
      )}

      {selected && <ReportDetail report={selected} onClose={() => setSelected(null)} />}
      {showGuide && <AnalystGuide onClose={() => setShowGuide(false)} onPick={(name) => applySearch("worker", name)} />}
    </div>
  );
}
