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
};
