# 앱 아이콘 원본

파란 바탕 렌즈 안에 오르는 막대 세 개, 마지막 막대만 빨강(상승). 화면의 빨강 = 상승·필독 규칙과 맞춘 모양.

| 원본 | 쓰는 곳 |
|---|---|
| `icon-round.svg` | `app/icon.svg`, `public/icons/icon-192.png`, `icon-512.png` (모서리 투명) |
| `icon-full.svg` | `app/apple-icon.png` 180px (iOS가 직접 둥글림, 투명 금지) |
| `icon-maskable.svg` | `public/icons/icon-maskable-512.png` (안드로이드 마스크, 글리프를 안전영역 안으로 줄임) |
| `icon-small.svg` | `app/favicon.ico` 16·32·48px (선을 굵게) |

PNG는 크롬으로 SVG를 그 크기 그대로 렌더해 만들었다. `components/NavBar.tsx`의 로고도 같은 모양.
