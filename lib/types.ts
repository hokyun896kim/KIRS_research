// 클라이언트/서버 공용 타입 (server-only import 없음)
import type { Profile } from "./profiles";

export type Report = {
  no: string | null;
  name: string;
  code: string | null;
  title: string;
  author: string;
  date: string;
  pdfUrl: string | null;
};

export type ListResult = {
  total: number | null;
  page: number;
  pageCount: number | null;
  reports: Report[];
};

export type ExtractResponse = {
  pages: number | null;
  textLength: number;
  analyst: string | null;
  ra: string | null;
  profile: Profile | null;
  raProfile: Profile | null;
  sector: { label: string; color: string };
  promptFull: string;
  promptTrade: string;
  counterLens: Profile; // 반론모드 렌즈 (요청한 lens 또는 기본 짝)
  promptCounter: string;
};

// 목록 화면용 브리핑 요약 (/api/briefs)
export type BriefSummary = {
  verdict: "필독" | "참고" | "패스";
  priority: "상" | "중" | "하";
  positiveOdds: number;
  conviction: number;
  headline: string;
};
export type AnalystSummary = { avg6: number; win6: number; n6: number }; // 6개월 시장 대비 초과수익
export type BriefsResponse = { briefs: Record<string, BriefSummary>; analysts: Record<string, AnalystSummary> };
