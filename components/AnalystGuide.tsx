"use client";

import { PROFILES } from "@/lib/profiles";
import AnalystCard from "./AnalystCard";

export default function AnalystGuide({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick?: (name: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40" onClick={onClose}>
      <div
        className="mx-auto mt-6 flex h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">애널리스트 도감 · 14인</h2>
            <p className="text-xs text-slate-500">
              각 애널의 렌즈·강점·주의점·주요 신호. 카드의 종목 영역을 누르면 그 애널 리포트만 모아 봐요.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4">
          {PROFILES.map((p) => (
            <div key={p.name} className="relative">
              <AnalystCard p={p} />
              {onPick && (
                <button
                  onClick={() => {
                    onPick(p.name);
                    onClose();
                  }}
                  className="absolute right-3 top-3 rounded-md border border-white/60 bg-white/70 px-2 py-1 text-[12px] font-medium text-slate-700 hover:bg-white"
                >
                  이 애널 리포트 보기 →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
