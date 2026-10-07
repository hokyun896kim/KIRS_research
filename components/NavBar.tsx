"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "리포트" },
  { href: "/scorecard", label: "애널 성적표" },
];

export default function NavBar() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-extrabold text-white shadow-sm">
            K
          </span>
          <span className="truncate text-[15px] font-bold tracking-tight text-slate-900">
            KIRS 렌즈
            <span className="ml-1.5 hidden text-xs font-medium text-slate-400 sm:inline">
              애널리스트별 리포트 분석기
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-sm">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
