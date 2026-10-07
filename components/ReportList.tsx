"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Report, ListResult, BriefsResponse, BriefSummary } from "@/lib/types";
import { PROFILES, matchProfile } from "@/lib/profiles";
import { classifySector, ALL_SECTORS } from "@/lib/sector";
import { Avatar, Block, BlockTitle, CompanyMark, VerdictBadge, oddsBar, oddsTone } from "./ui";
import ReportDetail from "./ReportDetail";
import { MIN_TRACK_N } from "./AnalystCard";
import AnalystGuide from "./AnalystGuide";

const VERDICT_RANK: Record<BriefSummary["verdict"], number> = { 필독: 0, 참고: 1, 패스: 2 };
const shortDate = (d: string) => d.slice(2).replaceAll("-", ".");

function todayLabel() {
  return new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-g400" aria-hidden>
      <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path
        d={dir === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 오른쪽 AI 칸: 긍정 가능성 숫자 + 판정
function AiCell({ b, loading }: { b?: BriefSummary; loading: boolean }) {
  if (b)
    return (
      <div className="flex flex-col items-end gap-1 justify-self-end">
        <span className={`num text-[17px] font-bold leading-none ${oddsTone(b.positiveOdds)}`}>{b.positiveOdds}%</span>
        <VerdictBadge verdict={b.verdict} />
      </div>
    );
  if (loading) return <div className="h-9 w-12 animate-pulse justify-self-end rounded-lg bg-g100" />;
  return <span className="justify-self-end text-[13px] text-g400">판정 전</span>;
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
  const [meta, setMeta] = useState<BriefsResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

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

  // 목록이 바뀌면 저장된 AI 브리핑 요약과 애널 성과를 한 번에 받아 온다 (새로 만들지는 않음)
  useEffect(() => {
    const nos = (data?.reports ?? []).map((r) => r.no).filter((n): n is string => !!n);
    if (!nos.length) return;
    let alive = true;
    setMetaLoading(true);
    fetch(`/api/briefs?nos=${nos.join(",")}`)
      .then((r) => (r.ok ? (r.json() as Promise<BriefsResponse>) : null))
      .then((j) => {
        if (!alive || !j) return;
        setMeta((m) => ({ briefs: { ...m?.briefs, ...j.briefs }, analysts: { ...m?.analysts, ...j.analysts } }));
      })
      .catch(() => {})
      .finally(() => alive && setMetaLoading(false));
    return () => {
      alive = false;
    };
  }, [data]);

  const rows = useMemo(() => {
    const list = (data?.reports ?? []).map((r) => ({ r, sector: classifySector(r.name, r.title) }));
    return sectorFilter ? list.filter((x) => x.sector.key === sectorFilter) : list;
  }, [data, sectorFilter]);

  const briefOf = (r: Report) => (r.no ? meta?.briefs[r.no] : undefined);

  // 첫 화면 상단: AI 판정이 끝난 최근 리포트를 필독 → 긍정 가능성 순으로
  const isHome = page === 1 && !keyword && !activeAnalyst && !sectorFilter;
  const picks = useMemo(
    () =>
      rows
        .map((x) => ({ ...x, b: x.r.no ? meta?.briefs[x.r.no] : undefined }))
        .filter((x): x is typeof x & { b: BriefSummary } => !!x.b)
        .sort((a, b) => VERDICT_RANK[a.b.verdict] - VERDICT_RANK[b.b.verdict] || b.b.positiveOdds - a.b.positiveOdds),
    [rows, meta],
  );

  const pageCount = data?.pageCount ?? 1;
  const blockStart = Math.floor((page - 1) / 10) * 10 + 1;
  const blockEnd = Math.min(blockStart + 9, pageCount);
  const searchArea = area === "worker" ? "subject" : area || "subject";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-2.5 pb-16 sm:space-y-4 sm:px-5 sm:pt-6">
      {/* AI가 먼저 읽은 리포트 */}
      {isHome && (
        <Block>
          <p className="text-[14px] font-medium text-g500">{todayLabel()}</p>
          <h1 className="mt-1 text-[24px] font-bold leading-snug tracking-tight text-g900 sm:text-[26px]">AI가 먼저 읽어본 리포트</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-g600">
            최근 KIRS 리포트를 바이사이드 눈으로 냉정하게 읽고, 핵심 논리가 실적으로 확인될 가능성을 매겼어요.
          </p>

          <div className="no-scrollbar -mx-5 mt-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:-mx-7 sm:px-7 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
            {(loading || (metaLoading && !picks.length)) &&
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[184px] w-[252px] shrink-0 animate-pulse rounded-3xl bg-g100 lg:w-auto" />)}
            {!loading &&
              picks.slice(0, 8).map(({ r, b }, idx) => {
                const p = matchProfile(r.author);
                return (
                  <button
                    key={`pick-${r.no}`}
                    onClick={() => setSelected(r)}
                    className={`press flex w-[252px] shrink-0 snap-start flex-col rounded-3xl bg-g50 p-5 text-left hover:bg-g100 lg:w-auto ${idx >= 4 ? "lg:hidden" : ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <VerdictBadge verdict={b.verdict} />
                      <span className="text-[12px] font-medium text-g500">검토 우선순위 {b.priority}</span>
                    </div>
                    <div className="mt-3 truncate text-[17px] font-bold text-g900">{r.name}</div>
                    <div className="mt-0.5 line-clamp-2 h-[40px] text-[14px] leading-[20px] text-g600">{r.title}</div>
                    <div className="mt-auto flex items-end justify-between pt-4">
                      <div>
                        <div className="text-[12px] text-g500">긍정 가능성</div>
                        <div className={`num text-[26px] font-bold leading-tight ${oddsTone(b.positiveOdds)}`}>{b.positiveOdds}%</div>
                      </div>
                      <span className="flex items-center gap-1.5 text-[13px] text-g600">
                        <Avatar name={r.author} stance={p?.stance} size="xs" />
                        {r.author}
                      </span>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-g200">
                      <div className={`h-full rounded-full ${oddsBar(b.positiveOdds)}`} style={{ width: `${b.positiveOdds}%` }} />
                    </div>
                  </button>
                );
              })}
            {!loading && !metaLoading && !picks.length && (
              <p className="py-6 text-[14px] text-g500">아직 AI 판정이 끝난 리포트가 없어요. 리포트를 누르면 바로 판정해요.</p>
            )}
          </div>
        </Block>
      )}

      {/* 전체 리포트 */}
      <Block>
        <BlockTitle
          sub={
            <>
              <span className="num">{data?.total?.toLocaleString() ?? "—"}</span>건 · 한국IR협의회 기업리서치센터
            </>
          }
          right={
            <button
              onClick={() => setShowGuide(true)}
              className="press h-9 shrink-0 rounded-xl bg-g100 px-3.5 text-[14px] font-semibold text-g700 hover:bg-g200"
            >
              애널 도감
            </button>
          }
        >
          {activeAnalyst ? `${activeAnalyst} 리포트` : keyword ? `“${keyword}” 검색 결과` : "전체 리포트"}
        </BlockTitle>

        {/* 검색 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applySearch(searchArea, draftKeyword.trim());
          }}
          className="flex h-12 items-center gap-2.5 rounded-2xl bg-g100 px-4 focus-within:ring-2 focus-within:ring-tb/30"
        >
          <SearchIcon />
          <input
            value={draftKeyword}
            onChange={(e) => setDraftKeyword(e.target.value)}
            placeholder="종목명이나 키워드로 검색"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-g900 outline-none placeholder:text-g400"
          />
          <select
            value={searchArea}
            onChange={(e) => setArea(e.target.value as typeof area)}
            aria-label="검색 범위"
            className="h-8 shrink-0 cursor-pointer rounded-lg bg-white px-2 text-[13px] font-semibold text-g600 outline-none"
          >
            <option value="subject">제목</option>
            <option value="content">내용</option>
          </select>
        </form>

        {/* 애널리스트 칩 */}
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 sm:-mx-7 sm:px-7">
          {[{ name: "", title: "전체" }, ...PROFILES.map((p) => ({ name: p.name, title: `${p.type} · ${p.guide}` }))].map((c) => {
            const on = c.name ? activeAnalyst === c.name : !activeAnalyst && !keyword;
            return (
              <button
                key={c.name || "all"}
                onClick={() => (c.name ? applySearch("worker", c.name) : applySearch("", ""))}
                title={c.name ? c.title : undefined}
                className={`press h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold transition ${
                  on ? "bg-g800 text-white" : "bg-g100 text-g700 hover:bg-g200"
                }`}
              >
                {c.name || "전체"}
              </button>
            );
          })}
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            title="현재 페이지 안에서 섹터로 거르기"
            className={`h-9 shrink-0 cursor-pointer rounded-full px-3 text-[14px] font-semibold outline-none ${
              sectorFilter ? "bg-g800 text-white" : "bg-g100 text-g700"
            }`}
          >
            <option value="">섹터 전체</option>
            {ALL_SECTORS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* 목록 머리 */}
        <div className="mt-5 hidden grid-cols-[minmax(0,1fr)_180px_88px] gap-4 border-b border-g100 px-2 pb-2 text-[13px] text-g500 md:grid">
          <span>종목 · 리포트</span>
          <span>애널리스트 · 6개월 승률</span>
          <span className="text-right">긍정 가능성</span>
        </div>
        <p className="mt-4 text-[12px] text-g500 md:hidden">오른쪽 숫자는 AI가 본 긍정 결론 가능성이에요.</p>

        <ul className="mt-1">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3.5 px-2 py-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-g100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-g100" />
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-g100" />
                </div>
              </li>
            ))}
          {!loading &&
            !err &&
            rows.map(({ r, sector }, i) => {
              const p = matchProfile(r.author);
              const a0 = meta?.analysts[r.author];
              const a = a0 && a0.n6 >= MIN_TRACK_N ? a0 : undefined;
              return (
                <li key={`${r.no}-${i}`}>
                  <button
                    data-row
                    onClick={() => setSelected(r)}
                    className="press grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-2 py-3.5 text-left hover:bg-g50 md:grid-cols-[minmax(0,1fr)_180px_88px]"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <CompanyMark name={r.name} sector={sector} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-baseline gap-1.5">
                          <span className="truncate text-[16px] font-semibold text-g900">{r.name}</span>
                          {sector.key !== "etc" && <span className="shrink-0 text-[12px] text-g500">{sector.label}</span>}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-[14px] text-g600">{r.title}</div>
                        <div className="num mt-0.5 text-[13px] text-g500 md:hidden">
                          {r.author}
                          {a && ` · 승률 ${(a.win6 * 100).toFixed(0)}%`} · {shortDate(r.date)}
                        </div>
                      </div>
                    </div>
                    <div className="hidden min-w-0 items-center gap-2.5 md:flex">
                      <Avatar name={r.author} stance={p?.stance} size="sm" />
                      <div className="min-w-0 leading-tight">
                        <div className="truncate text-[14px] font-semibold text-g800">{r.author}</div>
                        <div className="num mt-0.5 truncate text-[12px] text-g500">
                          {a ? `승률 ${(a.win6 * 100).toFixed(0)}% · ` : ""}
                          {shortDate(r.date)}
                        </div>
                      </div>
                    </div>
                    <AiCell b={briefOf(r)} loading={metaLoading} />
                  </button>
                </li>
              );
            })}
        </ul>

        {!loading && err && (
          <div className="py-12 text-center text-[15px] text-g600">
            목록을 불러오지 못했어요.
            <button onClick={load} className="ml-2 font-semibold text-tb">
              다시 시도
            </button>
            <div className="mt-1 text-[12px] text-g400">{err}</div>
          </div>
        )}
        {!loading && !err && rows.length === 0 && (
          <div className="py-12 text-center text-[15px] text-g500">
            {sectorFilter ? "이 페이지에는 해당 섹터 리포트가 없어요." : "검색 결과가 없어요."}
          </div>
        )}

        {/* 페이지 */}
        {pageCount > 1 && (
          <nav className="mt-4 flex items-center justify-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(Math.max(1, page - 1))}
              aria-label="이전 페이지"
              className="grid h-9 w-9 place-items-center rounded-full text-g600 hover:bg-g100 disabled:opacity-30"
            >
              <Chevron dir="left" />
            </button>
            <div className="no-scrollbar flex max-w-[64vw] gap-0.5 overflow-x-auto">
              {Array.from({ length: blockEnd - blockStart + 1 }, (_, i) => blockStart + i).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`num grid h-9 min-w-9 shrink-0 place-items-center rounded-full px-2 text-[15px] font-semibold transition ${
                    n === page ? "bg-g900 text-white" : "text-g600 hover:bg-g100"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              disabled={page >= pageCount}
              onClick={() => setPage(Math.min(pageCount, page + 1))}
              aria-label="다음 페이지"
              className="grid h-9 w-9 place-items-center rounded-full text-g600 hover:bg-g100 disabled:opacity-30"
            >
              <Chevron dir="right" />
            </button>
          </nav>
        )}
      </Block>

      <p className="px-5 text-[12px] leading-relaxed text-g400 sm:px-2">
        AI 판정은 리포트 본문과 작성 애널의 과거 적중률만 근거로 한 참고 의견이며 투자 권유가 아니에요.
      </p>

      {selected && (
        <ReportDetail
          key={`${selected.no}-${selected.date}`}
          report={selected}
          onClose={() => setSelected(null)}
          onOpenReport={setSelected}
        />
      )}
      {showGuide && <AnalystGuide onClose={() => setShowGuide(false)} onPick={(name) => applySearch("worker", name)} />}
    </div>
  );
}
