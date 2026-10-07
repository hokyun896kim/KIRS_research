"use client";

import { useEffect, useState } from "react";
import type { Group, VerdictStats } from "@/lib/verdict-stats";
import type { HorizonKey } from "@/lib/scorecard";

const pct = (v?: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
const tone = (v?: number | null) =>
  v == null
    ? "text-slate-400"
    : v > 0
      ? "text-rose-600"
      : v < 0
        ? "text-blue-600"
        : "text-slate-600";
const VERDICT_ICON: Record<string, string> = {
  필독: "🔥 필독",
  참고: "📌 참고",
  패스: "⏭ 패스",
};

function GroupTable({ title, groups }: { title: string; groups: Group[] }) {
  const maxAbs = Math.max(
    0.01,
    ...groups.map((g) => Math.abs(g.avgExcess ?? 0)),
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
      <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500">
        {title}
      </div>
      <ul className="divide-y divide-slate-100">
        {groups.map((g) => {
          const v = g.avgExcess ?? 0;
          const w = `${Math.min(50, (Math.abs(v) / maxAbs) * 50)}%`;
          const isAll = g.label.endsWith("전체");
          return (
            <li
              key={g.label}
              className={`px-4 py-2.5 ${isAll ? "bg-slate-50/70" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm ${isAll ? "font-semibold text-slate-500" : "font-medium text-slate-800"}`}
                >
                  {VERDICT_ICON[g.label] ?? g.label}
                  <span className="num ml-1.5 text-xs font-normal text-slate-400">
                    {g.n}건
                  </span>
                </span>
                <span className={`num text-sm font-bold ${tone(g.avgExcess)}`}>
                  {pct(g.avgExcess)}
                </span>
              </div>
              <div className="relative mt-1.5 h-1.5 rounded-full bg-slate-100">
                <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                {g.avgExcess != null && (
                  <span
                    className={`absolute inset-y-0 rounded-full ${v >= 0 ? "left-1/2 bg-rose-400" : "right-1/2 bg-blue-400"}`}
                    style={{ width: w }}
                  />
                )}
              </div>
              <div className="num mt-1 flex justify-between text-[11px] text-slate-400">
                <span>중앙 {pct(g.medianExcess)}</span>
                <span>
                  {g.winRate == null
                    ? "—"
                    : `승률 ${(g.winRate * 100).toFixed(0)}%`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function VerdictCheck({
  h,
  hLabel,
}: {
  h: HorizonKey;
  hLabel: string;
}) {
  const [stats, setStats] = useState<VerdictStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    setStats(null);
    fetch(`/api/verdicts/stats${all ? "?all=1" : ""}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as VerdictStats;
      })
      .then(setStats)
      .catch((e) => setErr(e.message));
  }, [all]);

  const g = stats?.horizons[h];

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            🤖 AI 판정 검증
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            AI가 🔥필독이라고 한 리포트, 정말 시장보다 더 올랐을까?
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={all}
            onChange={(e) => setAll(e.target.checked)}
          />
          {stats?.fairSince ?? "2025-09-01"} 이전 리포트 포함{" "}
          <span className="text-slate-400">(오염 가능)</span>
        </label>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          판정 통계를 불러오지 못했어요: {err}
        </div>
      )}
      {!stats && !err && (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl bg-slate-200/60"
            />
          ))}
        </div>
      )}

      {stats && !stats.enabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          판정 저장소(Vercel Blob)가 아직 연결되지 않았어요. 연결되면 AI
          자동분석 결과가 자동으로 쌓입니다.
        </div>
      )}

      {stats?.enabled && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
            {[
              ["저장된 판정", stats.verdictCount],
              ["앱 분석", (stats.byMode.full ?? 0) + (stats.byMode.trade ?? 0)],
              ["브리핑", stats.byMode.brief ?? 0],
              ["일괄", stats.byMode.backfill ?? 0],
              ["채점 매칭", stats.matched],
            ].map(([k, v]) => (
              <span
                key={k as string}
                className="rounded-full bg-white px-2.5 py-1 text-slate-500 ring-1 ring-slate-200"
              >
                {k} <b className="num font-semibold text-slate-800">{v}</b>
              </span>
            ))}
            {stats.pendingReports > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">
                일괄 판정 대기 <b className="num">{stats.pendingReports}</b>
              </span>
            )}
          </div>
          {g && g.overall.n > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              <GroupTable
                title={`판정별 · ${hLabel} 시장 대비`}
                groups={[...g.byVerdict, g.overall]}
              />
              <GroupTable
                title={`확신도별 · ${hLabel}`}
                groups={g.byConviction}
              />
              <GroupTable
                title={`AI 역산 업사이드별 · ${hLabel}`}
                groups={g.byUpside}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5 text-sm leading-relaxed text-slate-500">
              아직 {hLabel} 수익률까지 채점된 판정이 없어요. 상세 화면에서 AI
              자동분석(풀·매매모드)을 돌리면 판정이 자동 저장되고, 아래 관리자
              패널로 과거 리포트를 한꺼번에 판정할 수도 있어요.
            </div>
          )}
          <AdminPanel fairSince={stats.fairSince} />
        </>
      )}
    </section>
  );
}

type BackfillRes = {
  error?: string;
  candidates?: number;
  submitted?: number;
  wouldSubmit?: number;
  remaining?: number;
  estCostUSD?: number;
  batchId?: string;
  dryRun?: boolean;
};

function AdminPanel({ fairSince }: { fairSince: string }) {
  const [key, setKey] = useState("");
  const [since, setSince] = useState(fairSince);
  const [limit, setLimit] = useState(40);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackfillRes | null>(null);

  useEffect(() => {
    try {
      setKey(localStorage.getItem("kirs-admin-key") ?? "");
    } catch {
      /* 저장소 접근 불가 */
    }
  }, []);
  const rememberKey = (k: string) => {
    setKey(k);
    try {
      localStorage.setItem("kirs-admin-key", k);
    } catch {
      /* 무시 */
    }
  };

  async function backfill(dryRun: boolean) {
    setBusy(dryRun ? "preview" : "submit");
    setMsg(null);
    try {
      const r = await fetch("/api/verdicts/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, since, limit, dryRun }),
      });
      const j = (await r.json()) as BackfillRes;
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      if (dryRun) setPreview(j);
      else {
        setPreview(null);
        setMsg(
          `제출 완료: ${j.submitted}건 (배치 ${j.batchId}) · 남은 후보 ${j.remaining}건 · 예상 비용 약 $${j.estCostUSD?.toFixed(2)}. 보통 1시간 안에 끝나요.`,
        );
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    setMsg(null);
    try {
      const r = await fetch("/api/verdicts/sync");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const bs = j.batches as {
        id: string;
        status: string;
        saved?: number;
        failed?: number;
      }[];
      setMsg(
        bs.length
          ? bs
              .map((b) =>
                b.status === "ended"
                  ? `✓ ${b.saved}건 저장 (실패 ${b.failed})`
                  : `⏳ 처리 중 (${b.status})`,
              )
              .join(" · ") + " — 통계 반영까지 최대 10분"
          : "대기 중인 배치가 없어요.",
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <details className="group mt-4 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-600">
        <span>⚙ 관리자 · 과거 리포트 일괄 판정</span>
        <span className="text-xs text-slate-400 transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">
          앱의 모듈 7·8 기준으로 판정만 짧게 받아요 (Batch API, 50% 할인).
          비용은 회원님 Anthropic 키로 청구됩니다. 결과는 보통 1시간 안에 나오고
          매일 아침 자동으로 수거돼요.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => rememberKey(e.target.value)}
            placeholder="관리자 키 (ADMIN_KEY)"
            className="w-48 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 outline-none focus:border-indigo-400 focus:bg-white"
          />
          <label className="flex items-center gap-1 text-xs text-slate-500">
            발간일
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 outline-none focus:border-indigo-400 focus:bg-white"
            />
            이후
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 outline-none focus:border-indigo-400 focus:bg-white"
          >
            {[20, 40, 80].map((n) => (
              <option key={n} value={n}>
                한 번에 {n}건
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!key || !!busy}
            onClick={() => backfill(true)}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {busy === "preview" ? "계산 중… (PDF 읽는 중)" : "비용 미리보기"}
          </button>
          <button
            disabled={!key || !!busy || !preview?.wouldSubmit}
            onClick={() => {
              if (
                confirm(
                  `${preview?.wouldSubmit}건을 판정합니다. 예상 비용 약 $${preview?.estCostUSD?.toFixed(2)}. 진행할까요?`,
                )
              )
                backfill(false);
            }}
            className="rounded-full bg-indigo-600 px-4 py-1.5 font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-40"
          >
            {busy === "submit" ? "제출 중…" : "배치 제출"}
          </button>
          <button
            disabled={!!busy}
            onClick={sync}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {busy === "sync" ? "확인 중…" : "결과 가져오기"}
          </button>
        </div>
        {preview && (
          <div className="rounded-xl bg-indigo-50/60 p-3 text-xs text-slate-600 ring-1 ring-indigo-100">
            후보 {preview.candidates}건 중 이번에 {preview.wouldSubmit}건 · 예상
            비용 약 <b>${preview.estCostUSD?.toFixed(2)}</b> · 남은 후보{" "}
            {(preview.candidates ?? 0) - (preview.wouldSubmit ?? 0)}건
          </div>
        )}
        {msg && (
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            {msg}
          </div>
        )}
      </div>
    </details>
  );
}
