"use client";

import { useState } from "react";
import type { Profile } from "@/lib/profiles";
import type { AnalystSummary } from "@/lib/types";
import { Avatar, pct, retTone } from "./ui";

// 채점 리포트가 이보다 적으면 성과 숫자를 보여주지 않는다 (1~2건짜리 -67% 같은 숫자는 오해를 부름)
export const MIN_TRACK_N = 5;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 py-2.5">
      <dt className="text-[14px] text-g500">{label}</dt>
      <dd className="text-[15px] leading-relaxed text-g800">{children}</dd>
    </div>
  );
}

// 애널 프로필 카드. collapsible이면 원퀘스천·한 줄 지침만 보이고 펼쳐서 자세히 본다.
export default function AnalystCard({
  p,
  role,
  collapsible,
  track,
  footer,
}: {
  p: Profile;
  role?: string;
  collapsible?: boolean;
  track?: AnalystSummary;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-g100">
      <div className="flex items-center gap-3.5">
        <Avatar name={p.name} stance={p.stance} size="lg" />
        <div className="min-w-0 flex-1">
          {role && <div className="text-[13px] font-medium text-g500">{role}</div>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[18px] font-bold tracking-tight text-g900">{p.name}</span>
            <span className="text-[14px] text-g600">{p.type}</span>
            {p.warn && <span className="rounded-md bg-to-50 px-1.5 py-0.5 text-[12px] font-semibold text-orange-700">표본 적음</span>}
          </div>
        </div>
      </div>

      <p className="mt-4 text-[17px] font-semibold leading-snug text-g900">“{p.oneQuestion}”</p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-g600">{p.guide}</p>

      {track && track.n6 >= MIN_TRACK_N && (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-g50 p-3.5 text-center">
          <div>
            <div className="text-[12px] text-g500">6개월 평균</div>
            <div className={`num mt-0.5 text-[16px] font-bold ${retTone(track.avg6)}`}>{pct(track.avg6)}</div>
          </div>
          <div>
            <div className="text-[12px] text-g500">시장 이긴 비율</div>
            <div className="num mt-0.5 text-[16px] font-bold text-g900">{(track.win6 * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-[12px] text-g500">채점 리포트</div>
            <div className="num mt-0.5 text-[16px] font-bold text-g900">{track.n6}건</div>
          </div>
        </div>
      )}

      {open && (
        <dl className="mt-3 divide-y divide-g100">
          <Row label="스탠스">{p.stance}</Row>
          <Row label="강점">{p.strength}</Row>
          <Row label="주의·검증">{p.caution}</Row>
          <Row label="문법">{p.keyword}</Row>
          <Row label="강한 섹터">
            <div className="flex flex-wrap gap-1.5">
              {p.sectors.map((s) => (
                <span key={s} className="rounded-lg bg-g100 px-2 py-0.5 text-[13px] text-g700">
                  {s}
                </span>
              ))}
            </div>
          </Row>
          <Row label="신호 읽기">
            <ul className="space-y-1.5">
              {p.signals.map((s, i) => (
                <li key={i} className="text-[14px] leading-relaxed text-g700">
                  {s}
                </li>
              ))}
            </ul>
          </Row>
        </dl>
      )}

      {collapsible && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="press mt-4 h-11 w-full rounded-xl bg-g100 text-[14px] font-semibold text-g700 hover:bg-g200"
        >
          {open ? "접기" : "프로필 자세히 보기"}
        </button>
      )}
      {footer}
    </div>
  );
}
