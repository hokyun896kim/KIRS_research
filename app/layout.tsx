import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KIRS 리포트 애널리스트별 분석기",
  description:
    "한국IR협의회 기업리서치센터 리포트를 작성 애널리스트별 렌즈로 분석하는 프롬프트를 자동 생성합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
