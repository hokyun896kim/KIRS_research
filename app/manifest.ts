import type { MetadataRoute } from "next";

// 홈 화면에 추가하면 앱처럼 열리게 (PWA 매니페스트)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KIRS 렌즈 · 애널리스트별 리포트 분석",
    short_name: "KIRS 렌즈",
    description: "한국IR협의회 리포트를 AI가 먼저 읽고, 작성 애널리스트의 렌즈로 냉정하게 판단해요.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2f4f6",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
