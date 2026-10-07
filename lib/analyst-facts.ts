import "server-only";
import { getContextSnapshot } from "./context-snapshot";
import { classifySector } from "./sector";
import type { AnalystFacts } from "./types";

// 애널별 사실 정보: 리포트 수·활동 기간·주력 섹터·기간별 성과 (도감·렌즈 카드 표시용, 비용 없음)
// 성과는 지금까지 채점된 전체 기준이라 표시용으로만 쓴다. 분석 프롬프트에는 발간일 기준 성과(analysis-context.ts)를 쓴다.
const ACTIVE_DAYS = 180;

export async function getAnalystFacts(): Promise<Record<string, AnalystFacts>> {
  const snap = await getContextSnapshot();
  if (!snap) return {};
  const today = Date.now();
  const by = new Map<string, { dates: string[]; sectors: Map<string, number> }>();
  for (const [, name, date, author, title] of snap.index) {
    for (const a of author.split(/[,\s]+/).filter(Boolean)) {
      const cur = by.get(a) ?? { dates: [] as string[], sectors: new Map<string, number>() };
      cur.dates.push(date);
      const s = classifySector(name, title).label;
      cur.sectors.set(s, (cur.sectors.get(s) ?? 0) + 1);
      by.set(a, cur);
    }
  }
  const perf = new Map<string, Record<"3M" | "6M" | "12M", number[]>>();
  for (const [author, , e3, e6, e12] of snap.track) {
    const p = perf.get(author) ?? { "3M": [], "6M": [], "12M": [] };
    if (e3 != null) p["3M"].push(e3);
    if (e6 != null) p["6M"].push(e6);
    if (e12 != null) p["12M"].push(e12);
    perf.set(author, p);
  }

  const out: Record<string, AnalystFacts> = {};
  for (const [author, v] of by) {
    const dates = v.dates.sort();
    const n = dates.length;
    const sectors = [...v.sectors.entries()]
      .filter(([label]) => label !== "기타")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, c]) => ({ label, share: c / n }));
    const p = perf.get(author);
    const stat = (xs?: number[]) =>
      xs && xs.length ? { n: xs.length, avg: xs.reduce((a, b) => a + b, 0) / xs.length, win: xs.filter((x) => x > 0).length / xs.length } : null;
    out[author] = {
      reports: n,
      first: dates[0],
      last: dates[n - 1],
      active: today - Date.parse(dates[n - 1]) < ACTIVE_DAYS * 86400_000,
      sectors,
      perf: { "3M": stat(p?.["3M"]), "6M": stat(p?.["6M"]), "12M": stat(p?.["12M"]) },
    };
  }
  return out;
}
