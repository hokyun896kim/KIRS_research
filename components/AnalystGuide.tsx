"use client";

import { useState } from "react";
import { PROFILES } from "@/lib/profiles";
import AnalystCard from "./AnalystCard";
import { Avatar } from "./ui";

const FAMILIES = [
  "전체",
  "구조확신형",
  "조건부기대형",
  "발굴소개형",
  "턴어라운드기대형",
  "이벤트대기형",
] as const;

export default function AnalystGuide({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick?: (name: string) => void;
}) {
  const [family, setFamily] = useState<(typeof FAMILIES)[number]>("전체");
  const list =
    family === "전체"
      ? PROFILES
      : PROFILES.filter((p) => p.stance.startsWith(family));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" />
      <div
        className="relative flex h-[92vh] w-full max-w-5xl animate-pop-in flex-col overflow-hidden rounded-t-3xl bg-[#f6f7f9] shadow-pop sm:h-[88vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-none border-b border-slate-200/80 bg-white px-5 pb-3 pt-4 sm:px-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-extrabold tracking-tight text-slate-900">
                📖 애널리스트 도감 · 14인
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                각 애널의 렌즈·강점·주의점·주요 신호. 카드의{" "}
                <b className="font-semibold text-slate-700">
                  이 애널 리포트 보기
                </b>
                를 누르면 그 애널 리포트만 모아 봐요.
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
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
            {FAMILIES.map((f) => (
              <button
                key={f}
                onClick={() => setFamily(f)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                  family === f
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>
        <div className="grid flex-1 auto-rows-max grid-cols-1 gap-3 overflow-y-auto p-4 sm:p-6 lg:grid-cols-2">
          {list.map((p) => (
            <div key={p.name} className="flex flex-col gap-1.5">
              <AnalystCard p={p} />
              {onPick && (
                <button
                  onClick={() => {
                    onPick(p.name);
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Avatar name={p.name} stance={p.stance} size="xs" />
                  {p.name} 리포트만 보기 →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
