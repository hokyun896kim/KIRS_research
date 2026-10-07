import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: { default: "KIRS 렌즈", template: "%s · KIRS 렌즈" },
  description: "한국IR협의회 리포트를 AI가 먼저 읽고, 작성 애널리스트의 렌즈로 냉정하게 판단해요.",
  applicationName: "KIRS 렌즈",
  // 아이콘은 app/icon.svg · app/favicon.ico, 매니페스트는 app/manifest.ts.
  // 아이폰 홈 화면 아이콘은 주소를 고정해서 직접 건다. iOS는 한 번 받은 아이콘을 주소 기준으로 오래 기억해서,
  // 모양을 바꿀 땐 파일 이름(-v2)을 올려야 새로 받는다.
  // (icons를 직접 쓰면 app/icon.svg 자동 연결이 빠지므로 함께 적는다)
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }],
    apple: [{ url: "/icons/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "KIRS 렌즈", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // 예전 iOS 사파리는 이 이름만 알아본다 (Next는 mobile-web-app-capable만 넣어 줌)
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
