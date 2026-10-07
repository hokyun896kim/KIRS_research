"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "리포트" },
  { href: "/scorecard", label: "애널 성적표" },
];

// 렌즈 모양 로고 (파란 원 + 손잡이)
function Logo() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <rect width="28" height="28" rx="8" fill="#3182f6" />
      <circle cx="12.5" cy="12.5" r="5.5" fill="none" stroke="#fff" strokeWidth="2.6" />
      <path d="M16.6 16.6 21 21" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export default function NavBar() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo />
          <span className="text-[17px] font-bold tracking-tight text-g900">KIRS 렌즈</span>
        </Link>
        <div className="flex items-center gap-5 text-[15px]">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative py-4 font-semibold transition ${active ? "text-g900" : "text-g500 hover:text-g800"}`}
              >
                {l.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-g900" />}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
