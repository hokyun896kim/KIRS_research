import "server-only";
import { fetchPdf, extractPdfText, detectAuthors } from "./kirs";
import { matchProfile, type Profile } from "./profiles";

export type ReportMeta = { name: string; code: string | null; title: string; date: string; author: string };

export type LoadedReport = {
  report: ReportMeta;
  buf: Buffer;
  pages: number | null;
  text: string;
  analyst: string | null;
  ra: string | null;
  profile?: Profile;
  raProfile?: Profile;
};

export function metaFrom(get: (k: string) => string | null | undefined): ReportMeta {
  return {
    name: get("name") ?? "",
    code: get("code") || null,
    title: get("title") ?? "",
    date: get("date") ?? "",
    author: get("author") ?? "",
  };
}

// PDF 한 번 받아서 본문 추출 + 작성자 식별 + 프로파일 매칭까지
export async function loadReport(url: string, report: ReportMeta): Promise<LoadedReport> {
  const buf = await fetchPdf(url);
  const { pages, text } = await extractPdfText(buf);
  const { analyst, ra } = detectAuthors(text);
  return {
    report,
    buf,
    pages,
    text,
    analyst,
    ra,
    profile: matchProfile(analyst ?? report.author),
    raProfile: ra ? matchProfile(ra) : undefined,
  };
}
