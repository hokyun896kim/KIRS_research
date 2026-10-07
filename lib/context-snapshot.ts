import "server-only";
import type { Scorecard } from "./scorecard";
import type { Report } from "./kirs";
import { blobEnabled, putJson, readJson } from "./verdicts";

// 분석 프롬프트용 성적·이력 자료를 Blob에 작게 저장해 둔다.
// unstable_cache는 함수(라우트)마다 따로 놀아서 extract·analyze에서는 매번 다시 계산(수 초~수십 초)하는 일이 있었다.
// 성적표가 새로 계산될 때(매일 아침 크론) 한 번 쓰고, 읽는 쪽은 인스턴스 메모리에 잠깐 들고 있는다.
const PATH = "cache/context-v1.json";
const MEMO_MS = 10 * 60_000;

type TrackRow = [author: string, date: string, e3: number | null, e6: number | null, e12: number | null];
type IndexRow = [code: string | null, name: string, date: string, author: string, title: string];
export type ContextSnapshot = { generatedAt: string; track: TrackRow[]; index: IndexRow[] };

let memo: { at: number; snap: ContextSnapshot | null } | null = null;

export async function getContextSnapshot(): Promise<ContextSnapshot | null> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.snap;
  if (!blobEnabled()) return null;
  const snap = await readJson<ContextSnapshot>(PATH).catch(() => null);
  memo = { at: Date.now(), snap };
  return snap;
}

// 성적표가 바뀌었을 때만 다시 쓴다
export async function refreshContextSnapshot(sc: Scorecard, index: Report[]) {
  if (!blobEnabled()) return;
  const cur = await getContextSnapshot();
  if (cur && cur.generatedAt >= sc.generatedAt) return;
  const snap: ContextSnapshot = {
    generatedAt: sc.generatedAt,
    track: sc.rows.map((r) => [r.author, r.date, r.excess["3M"] ?? null, r.excess["6M"] ?? null, r.excess["12M"] ?? null]),
    index: index.map((r) => [r.code, r.name, r.date, r.author, r.title]),
  };
  await putJson(PATH, snap);
  memo = { at: Date.now(), snap };
}
