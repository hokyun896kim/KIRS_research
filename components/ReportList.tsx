"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Report, ListResult } from "@/lib/types";
import { PROFILES, matchProfile } from "@/lib/profiles";
import { classifySector, ALL_SECTORS } from "@/lib/sector";
import { Avatar, SectorPill } from "./ui";
import ReportDetail from "./ReportDetail";
import AnalystGuide from "./AnalystGuide";

function AuthorBadge({
  author,
  compact,
}: {
  author: string;
  compact?: boolean;
}) {
  const p = matchProfile(author);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={author} stance={p?.stance} size={compact ? "sm" : "md"} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[13px] font-semibold text-slate-800">
          {author}
        </span>
        {p && !compact && (
          <span className="block truncate text-[11px] text-slate-400">
            {p.type}
          </span>
        )}
      </span>
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

  const load = useCallback(() => {
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
    const list = (data?.reports ?? []).map((r) => ({
      r,
      sector: classifySector(r.name, r.title),
    }));
    return sectorFilter
      ? list.filter((x) => x.sector.key === sectorFilter)
      : list;
  }, [data, sectorFilter]);

  const pageCount = data?.pageCount ?? 1;
  const blockStart = Math.floor((page - 1) / 10) * 10 + 1;
  const blockEnd = Math.min(blockStart + 9, pageCount);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:pt-8">
      {/* 소개 */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-indigo-600">
            한국IR협의회 기업리서치센터
          </p>
          <h1 className="text-[22px] font-extrabold leading-snug tracking-tight text-slate-900 sm:text-[26px]">
            작성 애널리스트의 렌즈로 읽는 KIRS 리포트
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
            보고서를 누르면{" "}
            <b className="font-semibold text-slate-700">
              바이사이드 냉정 브리핑
            </b>
            ·애널 프로파일·완성 프롬프트·
            <b className="font-semibold text-slate-700">AI 자동분석</b>까지 한
            번에 봅니다.
          </p>
        </div>
        <button
          onClick={() => setShowGuide(true)}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-card transition hover:border-slate-300 hover:bg-slate-50 sm:self-auto"
        >
          <span>📖</span> 애널 도감 14인
        </button>
      </header>

      {/* 필터 */}
      <section className="mb-4 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card sm:p-4">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          <button
            onClick={() => applySearch("", "")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
              !activeAnalyst && !keyword
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            전체
          </button>
          {PROFILES.map((p) => {
            const on = activeAnalyst === p.name;
            return (
              <button
                key={p.name}
                onClick={() => applySearch("worker", p.name)}
                title={`${p.type} · ${p.guide}`}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[13px] font-medium transition ${
                  on
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Avatar name={p.name} stance={p.stance} size="xs" />
                {p.name}
                {p.warn && (
                  <span className={on ? "text-amber-300" : "text-amber-500"}>
                    ⚠
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            applySearch(
              area === "worker" ? "subject" : area || "subject",
              draftKeyword.trim(),
            );
          }}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
        >
          <div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50">
            <select
              value={area === "worker" ? "subject" : area || "subject"}
              onChange={(e) => setArea(e.target.value as typeof area)}
              className="h-11 shrink-0 cursor-pointer rounded-l-xl border-r border-slate-200 bg-transparent pl-3 pr-1 text-sm font-medium text-slate-600 outline-none"
            >
              <option value="subject">제목</option>
              <option value="content">내용</option>
            </select>
            <input
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              placeholder="종목·키워드 검색"
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-400"
            />
            <button className="mr-1 h-9 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700">
              검색
            </button>
          </div>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            title="현재 페이지 내 섹터 필터"
            className="h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none focus:border-indigo-400"
          >
            <option value="">섹터 전체</option>
            {ALL_SECTORS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </form>
      </section>

      {/* 결과 요약 */}
      <div className="mb-2 flex items-center justify-between px-1 text-[13px] text-slate-500">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {activeAnalyst && (
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
              애널 {activeAnalyst}
            </span>
          )}
          {keyword && !activeAnalyst && (
            <span className="rounded-md bg-slate-200/60 px-2 py-0.5">
              “{keyword}”
            </span>
          )}
          {sectorFilter && (
            <span className="text-slate-400">섹터 필터 (현재 페이지)</span>
          )}
          <span>
            전체{" "}
            <b className="num font-bold text-slate-800">
              {data?.total?.toLocaleString() ?? "—"}
            </b>
            건
          </span>
        </span>
        <span className="num">
          {page} / {pageCount}
        </span>
      </div>

      {/* 목록 */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
        {/* 데스크톱 표 */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-400">
              <th className="w-52 px-5 py-3 font-medium">종목</th>
              <th className="px-3 py-3 font-medium">리포트</th>
              <th className="w-48 px-3 py-3 font-medium">애널리스트</th>
              <th className="w-28 px-5 py-3 text-right font-medium">발간일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-5 py-4">
                    <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
                  </td>
                </tr>
              ))}
            {!loading &&
              !err &&
              rows.map(({ r, sector }, i) => (
                <tr
                  key={`${r.no}-${i}`}
                  onClick={() => setSelected(r)}
                  className="group cursor-pointer transition hover:bg-indigo-50/40"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900 group-hover:text-indigo-700">
                      {r.name}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {r.code && (
                        <span className="num text-xs text-slate-400">
                          {r.code}
                        </span>
                      )}
                      <SectorPill sector={sector} />
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-[14px] leading-snug text-slate-700">
                    {r.title}
                  </td>
                  <td className="px-3 py-3.5">
                    <AuthorBadge author={r.author} />
                  </td>
                  <td className="num px-5 py-3.5 text-right text-xs text-slate-400">
                    {r.date}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* 모바일 카드 */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="space-y-2 p-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              </li>
            ))}
          {!loading &&
            !err &&
            rows.map(({ r, sector }, i) => (
              <li
                key={`${r.no}-${i}`}
                data-row
                onClick={() => setSelected(r)}
                className="cursor-pointer p-4 active:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-bold text-slate-900">
                      {r.name}
                    </span>
                    <SectorPill sector={sector} />
                  </div>
                  <span className="num shrink-0 text-xs text-slate-400">
                    {r.date.slice(2).replaceAll("-", ".")}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-slate-600">
                  {r.title}
                </p>
                <div className="mt-2">
                  <AuthorBadge author={r.author} compact />
                </div>
              </li>
            ))}
        </ul>

        {!loading && err && (
          <div className="px-5 py-12 text-center text-sm text-red-600">
            목록을 불러오지 못했습니다: {err}
            <button onClick={load} className="ml-2 font-semibold underline">
              재시도
            </button>
          </div>
        )}
        {!loading && !err && rows.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-slate-400">
            {sectorFilter
              ? "이 페이지엔 해당 섹터 리포트가 없어요. (섹터 필터는 현재 페이지 기준)"
              : "결과가 없습니다."}
          </div>
        )}
      </section>

      {/* 페이지네이션 */}
      {pageCount > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-1 text-sm">
          {[
            { label: "«", to: 1, off: page === 1 },
            { label: "‹", to: Math.max(1, page - 1), off: page === 1 },
          ].map((b) => (
            <button
              key={b.label}
              disabled={b.off}
              onClick={() => setPage(b.to)}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white hover:shadow-card disabled:opacity-30"
            >
              {b.label}
            </button>
          ))}
          <div className="no-scrollbar flex max-w-[60vw] gap-1 overflow-x-auto">
            {Array.from(
              { length: blockEnd - blockStart + 1 },
              (_, i) => blockStart + i,
            ).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`num grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-2 font-semibold transition ${
                  n === page
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:shadow-card"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {[
            {
              label: "›",
              to: Math.min(pageCount, page + 1),
              off: page >= pageCount,
            },
            { label: "»", to: pageCount, off: page >= pageCount },
          ].map((b) => (
            <button
              key={b.label}
              disabled={b.off}
              onClick={() => setPage(b.to)}
              className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-white hover:shadow-card disabled:opacity-30"
            >
              {b.label}
            </button>
          ))}
        </nav>
      )}

      {selected && (
        <ReportDetail
          key={`${selected.no}-${selected.date}`}
          report={selected}
          onClose={() => setSelected(null)}
          onOpenReport={setSelected}
        />
      )}
      {showGuide && (
        <AnalystGuide
          onClose={() => setShowGuide(false)}
          onPick={(name) => applySearch("worker", name)}
        />
      )}
    </div>
  );
}
