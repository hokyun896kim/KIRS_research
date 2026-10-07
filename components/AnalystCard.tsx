"use client";

import { useState } from "react";
import type { Profile } from "@/lib/profiles";
import { Avatar } from "./ui";

export function stanceColor(stance?: string): string {
  if (!stance) return "bg-slate-100 text-slate-700 border-slate-200";
  if (stance.startsWith("구조확신"))
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (stance.startsWith("조건부"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (stance.startsWith("발굴소개"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (stance.startsWith("턴어라운드"))
    return "bg-orange-50 text-orange-700 border-orange-200";
  if (stance.startsWith("이벤트"))
    return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function stanceDot(stance?: string): string {
  if (!stance) return "bg-slate-300";
  if (stance.startsWith("구조확신")) return "bg-blue-500";
  if (stance.startsWith("조건부")) return "bg-amber-500";
  if (stance.startsWith("발굴소개")) return "bg-emerald-500";
  if (stance.startsWith("턴어라운드")) return "bg-orange-500";
  if (stance.startsWith("이벤트")) return "bg-violet-500";
  return "bg-slate-300";
}

// 스탠스 계열별 왼쪽 강조선 색
function stanceBar(stance?: string): string {
  if (!stance) return "bg-slate-300";
  if (stance.startsWith("구조확신")) return "bg-blue-500";
  if (stance.startsWith("조건부")) return "bg-amber-400";
  if (stance.startsWith("발굴소개")) return "bg-emerald-500";
  if (stance.startsWith("턴어라운드")) return "bg-orange-500";
  if (stance.startsWith("이벤트")) return "bg-violet-500";
  return "bg-slate-300";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] leading-snug text-slate-700">
        {children}
      </div>
    </div>
  );
}

export default function AnalystCard({
  p,
  role,
  collapsible,
}: {
  p: Profile;
  role?: string;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 pl-5 shadow-card">
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${stanceBar(p.stance)}`}
      />
      <div className="flex items-start gap-3">
        <Avatar name={p.name} stance={p.stance} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {role && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                {role}
              </span>
            )}
            <span className="text-[17px] font-extrabold tracking-tight text-slate-900">
              {p.name}
            </span>
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${stanceColor(p.stance)}`}
            >
              {p.type}
            </span>
            {p.warn && (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                ⚠ 공동작성 영향 큼(관찰)
              </span>
            )}
          </div>
          <div className="mt-1.5 text-[14px] font-semibold text-slate-700">
            💬 “{p.oneQuestion}”
          </div>
          {!open && (
            <div className="mt-1 text-[12.5px] text-slate-500">{p.guide}</div>
          )}
        </div>
        {collapsible && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {open ? "접기 ▴" : "프로필 자세히 ▾"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3.5 grid grid-cols-1 gap-x-5 gap-y-3 border-t border-slate-100 pt-3.5 sm:grid-cols-2">
          <Field label="스탠스">{p.stance}</Field>
          <Field label="한 줄 지침">{p.guide}</Field>
          <Field label="강점">{p.strength}</Field>
          <Field label="주의·검증">{p.caution}</Field>
          <div className="sm:col-span-2">
            <Field label="문법·키워드">{p.keyword}</Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="강한 섹터">
              <div className="mt-1 flex flex-wrap gap-1">
                {p.sectors.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-600"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="주요 신호 (이렇게 쓰면 → 이렇게 읽어라)">
              <ul className="mt-0.5 space-y-1">
                {p.signals.map((s, i) => (
                  <li
                    key={i}
                    className="flex gap-1.5 text-[12.5px] leading-snug"
                  >
                    <span className="text-slate-300">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
