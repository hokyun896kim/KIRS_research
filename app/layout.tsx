import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "KIRS 리포트 애널리스트별 분석기",
  description:
    "한국IR협의회 기업리서치센터 리포트를 작성 애널리스트별 렌즈로 분석하는 프롬프트를 자동 생성합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* Pretendard (SIL OFL) — public/fonts/pretendard, 필요한 글자 조각만 내려받음 */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css" />
      </head>
      <body className="flex min-h-full flex-col">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
