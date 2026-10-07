"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "리포트" },
  { href: "/scorecard", label: "애널 성적표" },
];

// 앱 아이콘(app/icon.svg)과 같은 모양: 파란 바탕 렌즈 + 오르는 막대
function Logo() {
  return (
    <svg viewBox="0 0 1024 1024" className="h-7 w-7" aria-hidden>
      <defs>
        <linearGradient id="nav-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4b9bff" />
          <stop offset="1" stopColor="#1b64da" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="232" fill="url(#nav-logo)" />
      <g transform="translate(512 512) scale(1.02) translate(-492 -492)">
        <circle cx="448" cy="448" r="206" fill="none" stroke="#fff" strokeWidth="92" />
        <path d="M600 600 L742 742" stroke="#fff" strokeWidth="112" strokeLinecap="round" />
        <rect x="364" y="420" width="46" height="112" rx="16" fill="#fff" fillOpacity=".7" />
        <rect x="426" y="376" width="46" height="156" rx="16" fill="#fff" fillOpacity=".85" />
        <rect x="488" y="330" width="46" height="202" rx="16" fill="#ff5c6c" />
      </g>
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
