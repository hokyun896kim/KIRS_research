"use client";

import { useEffect, useState } from "react";
import type { Group, VerdictStats } from "@/lib/verdict-stats";
import type { HorizonKey } from "@/lib/scorecard";
import { Block, BlockTitle, pct, retTone as tone } from "./ui";

function GroupList({ title, groups }: { title: string; groups: Group[] }) {
  const maxAbs = Math.max(0.01, ...groups.map((g) => Math.abs(g.avgExcess ?? 0)));
  return (
    <div className="rounded-2xl bg-g50 p-4">
      <div className="mb-1 text-[14px] font-semibold text-g600">{title}</div>
      <ul>
        {groups.map((g) => {
          const v = g.avgExcess ?? 0;
          const w = `${Math.min(50, (Math.abs(v) / maxAbs) * 50)}%`;
          const isAll = g.label.endsWith("전체");
          return (
            <li key={g.label} className={`py-2.5 ${isAll ? "mt-1 border-t border-g200" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-[15px] ${isAll ? "font-medium text-g600" : "font-semibold text-g900"}`}>
                  {g.label}
                  <span className="num ml-1.5 text-[13px] font-normal text-g500">{g.n}건</span>
                </span>
                <span className={`num text-[16px] font-bold ${tone(g.avgExcess)}`}>{pct(g.avgExcess)}</span>
              </div>
              <div className="relative mt-2 h-1.5 rounded-full bg-g200">
                <span className="absolute inset-y-[-2px] left-1/2 w-px bg-g300" />
                {g.avgExcess != null && (
                  <span
                    className={`absolute inset-y-0 rounded-full ${v >= 0 ? "left-1/2 bg-tr" : "right-1/2 bg-tb"}`}
                    style={{ width: w }}
                  />
                )}
              </div>
              <div className="num mt-1.5 flex justify-between text-[12px] text-g500">
                <span>중앙값 {pct(g.medianExcess)}</span>
                <span>{g.winRate == null ? "—" : `승률 ${(g.winRate * 100).toFixed(0)}%`}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function VerdictCheck({ h, hLabel }: { h: HorizonKey; hLabel: string }) {
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
    <Block>
      <BlockTitle sub="AI가 본 긍정 가능성 상위 20%(필독), 정말 시장보다 더 올랐을까요?">AI 판정 검증</BlockTitle>

      <button
        onClick={() => setAll((v) => !v)}
        className={`press mb-4 h-9 rounded-full px-3.5 text-[14px] font-semibold ${all ? "bg-g800 text-white" : "bg-g100 text-g700"}`}
      >
        {stats?.fairSince ?? "2026-07-01"} 이전 리포트도 포함 {all ? "(오염 가능)" : ""}
      </button>

      {err && <p className="text-[15px] text-g600">판정 통계를 불러오지 못했어요. {err}</p>}
      {!stats && !err && (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-g100" />
          ))}
        </div>
      )}

      {stats && !stats.enabled && (
        <p className="rounded-2xl bg-g50 p-4 text-[15px] text-g600">
          판정 저장소(Vercel Blob)가 아직 연결되지 않았어요. 연결되면 AI 분석 결과가 자동으로 쌓여요.
        </p>
      )}

      {stats?.enabled && (
        <>
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-g500">
            {[
              ["저장된 판정", stats.verdictCount],
              ["앱 분석", (stats.byMode.full ?? 0) + (stats.byMode.trade ?? 0)],
              ["브리핑", stats.byMode.brief ?? 0],
              ["일괄", stats.byMode.backfill ?? 0],
              ["채점 매칭", stats.matched],
            ].map(([k, v]) => (
              <span key={k as string}>
                {k} <b className="num font-semibold text-g800">{v}</b>
              </span>
            ))}
            {stats.pendingReports > 0 && (
              <span className="text-orange-700">
                일괄 판정 대기 <b className="num">{stats.pendingReports}</b>
              </span>
            )}
          </div>
          {g && g.overall.n > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              <GroupList title={`판정별(긍정 가능성 순위) · ${hLabel} 뒤 시장 대비`} groups={[...g.byVerdict, g.overall]} />
              <GroupList title={`확신도별 · ${hLabel}`} groups={g.byConviction} />
              <GroupList title={`AI 역산 업사이드별 · ${hLabel}`} groups={g.byUpside} />
            </div>
          ) : (
            <p className="rounded-2xl bg-g50 p-5 text-[15px] leading-relaxed text-g600">
              아직 {hLabel} 수익률까지 채점된 판정이 없어요. 상세 화면에서 AI 분석(풀·매매모드)을 돌리면 판정이 자동으로 저장되고, 아래 관리자
              메뉴로 과거 리포트를 한꺼번에 판정할 수도 있어요.
            </p>
          )}
          <AdminPanel fairSince={stats.fairSince} />
        </>
      )}
    </Block>
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
    <details className="group mt-4 rounded-2xl bg-g50 px-4 py-3.5 text-[14px]">
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-g600">
        <span>⚙ 관리자 · 과거 리포트 일괄 판정</span>
        <span className="text-[13px] text-g400 transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-3 space-y-3 border-t border-g200 pt-3">
        <p className="text-[13px] text-g500">
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
            className="w-48 rounded-lg bg-white px-3 py-2 outline-none ring-1 ring-g200 focus:ring-tb"
          />
          <label className="flex items-center gap-1 text-[13px] text-g500">
            발간일
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="rounded-lg bg-white px-3 py-2 outline-none ring-1 ring-g200 focus:ring-tb"
            />
            이후
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg bg-white px-3 py-2 outline-none ring-1 ring-g200 focus:ring-tb"
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
            className="press h-10 rounded-xl bg-white px-4 font-semibold text-g700 ring-1 ring-g200 disabled:opacity-40"
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
            className="press h-10 rounded-xl bg-tb px-4 font-semibold text-white hover:bg-tb-600 disabled:opacity-40"
          >
            {busy === "submit" ? "제출 중…" : "배치 제출"}
          </button>
          <button
            disabled={!!busy}
            onClick={sync}
            className="press h-10 rounded-xl bg-white px-4 font-semibold text-g700 ring-1 ring-g200 disabled:opacity-40"
          >
            {busy === "sync" ? "확인 중…" : "결과 가져오기"}
          </button>
        </div>
        {preview && (
          <div className="rounded-xl bg-tb-50 p-3 text-[13px] text-g700">
            후보 {preview.candidates}건 중 이번에 {preview.wouldSubmit}건 · 예상
            비용 약 <b>${preview.estCostUSD?.toFixed(2)}</b> · 남은 후보{" "}
            {(preview.candidates ?? 0) - (preview.wouldSubmit ?? 0)}건
          </div>
        )}
        {msg && (
          <div className="rounded-xl bg-white p-3 text-[13px] text-g700">
            {msg}
          </div>
        )}
      </div>
    </details>
  );
}
