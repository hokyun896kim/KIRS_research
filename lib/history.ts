import "server-only";
import { unstable_cache } from "next/cache";
import { fetchAllReports, type Report } from "./kirs";

// 1,200건+ 전체 색인은 6시간 캐시 (첫 빌드 20초 안팎)
export const getReportIndex = unstable_cache(() => fetchAllReports(), ["kirs-report-index-v1"], {
  revalidate: 6 * 3600,
  tags: ["kirs-report-index"],
});

// 같은 종목의 리포트를 최신순으로. 코드가 있으면 코드로, 없으면 종목명으로 매칭.
export async function findSameCompany(code: string | null, name: string): Promise<Report[]> {
  const all = await getReportIndex();
  const hits = all.filter((r) => (code ? r.code === code : r.name === name));
  const seen = new Set<string>();
  return hits
    .filter((r) => {
      const k = r.no ?? `${r.date}-${r.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
