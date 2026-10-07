"use client";

import { useState } from "react";
import { PROFILES } from "@/lib/profiles";
import AnalystCard from "./AnalystCard";

const FAMILIES = ["전체", "구조확신형", "조건부기대형", "발굴소개형", "턴어라운드기대형", "이벤트대기형"] as const;

export default function AnalystGuide({ onClose, onPick }: { onClose: () => void; onPick?: (name: string) => void }) {
  const [family, setFamily] = useState<(typeof FAMILIES)[number]>("전체");
  const list = family === "전체" ? PROFILES : PROFILES.filter((p) => p.stance.startsWith(family));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 animate-fade-in bg-black/40" />
      <div
        className="relative flex h-[92dvh] w-full max-w-4xl animate-sheet-in flex-col overflow-hidden rounded-t-[28px] bg-g100 sm:h-[88vh] sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-none bg-white px-5 pb-4 pt-3 sm:px-7 sm:pt-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-g200 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight text-g900">애널리스트 도감</h2>
              <p className="mt-1 text-[14px] text-g500">14명이 무엇을 보고, 어디를 조심해서 읽어야 하는지 정리했어요.</p>
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[18px] text-g500 hover:bg-g100"
            >
              ✕
            </button>
          </div>
          <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 sm:-mx-7 sm:px-7">
            {FAMILIES.map((f) => (
              <button
                key={f}
                onClick={() => setFamily(f)}
                className={`press h-9 shrink-0 rounded-full px-3.5 text-[14px] font-semibold ${
                  family === f ? "bg-g800 text-white" : "bg-g100 text-g700 hover:bg-g200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>
        <div className="grid flex-1 auto-rows-max grid-cols-1 gap-3 overflow-y-auto p-3 sm:p-5 lg:grid-cols-2">
          {list.map((p) => (
            <AnalystCard
              key={p.name}
              p={p}
              collapsible
              footer={
                onPick && (
                  <button
                    onClick={() => {
                      onPick(p.name);
                      onClose();
                    }}
                    className="press mt-2 h-11 w-full rounded-xl bg-tb-50 text-[14px] font-semibold text-tb hover:bg-[#dbeafe]"
                  >
                    {p.name} 리포트만 보기
                  </button>
                )
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
