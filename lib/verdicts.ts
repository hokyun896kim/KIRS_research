import "server-only";
import { put, list, del, get } from "@vercel/blob";

// AI 판정 저장소 (Vercel Blob). 판정 값을 경로에 넣어 두면 list() 한 번으로 전부 읽을 수 있다.
//   verdicts/v1/{no}__{mode}__{verdict}__{conviction}__{relative}__{upside}__{ts}.json

export type VerdictLabel = "필독" | "참고" | "패스";
export type Relative = "강함" | "평소" | "약함";
export type VerdictMode = "full" | "trade" | "backfill";

export type Verdict = {
  no: string;
  mode: VerdictMode;
  verdict: VerdictLabel | null;
  conviction: number | null; // 1~5
  relative: Relative | null; // 애널 평소 톤 대비
  baseUpside: number | null; // 기준 시나리오 업사이드 (0.564 = +56.4%)
  createdAt: string;
};

const V_CODE: Record<VerdictLabel, string> = { 필독: "must", 참고: "ref", 패스: "pass" };
const R_CODE: Record<Relative, string> = { 강함: "up", 평소: "same", 약함: "down" };
const inv = <T extends string>(m: Record<T, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<string, T>;
const V_DEC = inv(V_CODE);
const R_DEC = inv(R_CODE);

export const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// 스토어를 공개로 만들었을 수도 있어 비공개 → 공개 순으로 시도
async function putJson(pathname: string, data: unknown) {
  const body = JSON.stringify(data);
  const opts = { contentType: "application/json", addRandomSuffix: false, allowOverwrite: true } as const;
  try {
    return await put(pathname, body, { ...opts, access: "private" });
  } catch (e) {
    if (!/access|public|private/i.test((e as Error).message)) throw e;
    return await put(pathname, body, { ...opts, access: "public" });
  }
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  for (const access of ["private", "public"] as const) {
    try {
      const r = await get(pathname, { access, useCache: false });
      if (!r) return null;
      return (await new Response(r.stream).json()) as T;
    } catch {
      /* 다른 access로 재시도 */
    }
  }
  return null;
}

export async function saveVerdict(v: Verdict, detail?: Record<string, unknown>) {
  if (!blobEnabled() || !/^[0-9A-Za-z-]+$/.test(v.no)) return;
  const f = (x: number | null, d = 1) => (x == null ? "na" : x.toFixed(d));
  const name = [
    v.no,
    v.mode,
    v.verdict ? V_CODE[v.verdict] : "na",
    f(v.conviction),
    v.relative ? R_CODE[v.relative] : "na",
    v.baseUpside == null ? "na" : f(v.baseUpside * 100),
    Date.parse(v.createdAt) || Date.now(),
  ].join("__");
  await putJson(`verdicts/v1/${name}.json`, { ...v, ...detail });
}

async function listAll(prefix: string) {
  const out: { pathname: string; url: string }[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs.map((b) => ({ pathname: b.pathname, url: b.url })));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

export async function listVerdicts(): Promise<Verdict[]> {
  if (!blobEnabled()) return [];
  const num = (s: string) => (s === "na" ? null : Number(s));
  return (await listAll("verdicts/v1/"))
    .map(({ pathname }): Verdict | null => {
      const parts = pathname.replace(/^verdicts\/v1\//, "").replace(/\.json$/, "").split("__");
      if (parts.length !== 7) return null;
      const [no, mode, v, conv, rel, up, ts] = parts;
      return {
        no,
        mode: mode as VerdictMode,
        verdict: V_DEC[v] ?? null,
        conviction: num(conv),
        relative: R_DEC[rel] ?? null,
        baseUpside: up === "na" ? null : Number(up) / 100,
        createdAt: new Date(Number(ts)).toISOString(),
      };
    })
    .filter((x): x is Verdict => x != null);
}

// 일괄 판정 배치 기록: batches/{batchId}.json = { ids: 리포트 번호[], createdAt }
export type BatchRecord = { id: string; ids: string[]; since: string; createdAt: string };
export const saveBatch = (b: BatchRecord) => putJson(`batches/${b.id}.json`, b);
export async function listBatches(): Promise<BatchRecord[]> {
  if (!blobEnabled()) return [];
  const files = await listAll("batches/");
  const recs = await Promise.all(files.map((f) => readJson<BatchRecord>(f.pathname)));
  return recs.filter((r): r is BatchRecord => r != null);
}
export const deleteBatch = async (id: string) => del(`batches/${id}.json`);

// 분석 결과(마크다운)에서 모듈 7·8 판정을 뽑는다. 못 찾은 값은 null.
export function parseVerdict(md: string): Pick<Verdict, "verdict" | "conviction" | "relative" | "baseUpside"> {
  const i7 = md.search(/모듈\s*7/);
  const i8 = md.search(/모듈\s*8/);
  const m7 = i7 >= 0 ? md.slice(i7, i8 > i7 ? i8 : undefined) : md;
  const m8 = i8 >= 0 ? md.slice(i8) : "";
  const conv = m7.match(/확신도[^\d\n]{0,12}([0-5](?:\.\d)?)\s*\/\s*5/);
  const pick = m7.match(/판정[^\n]{0,30}?(🔥|📌|⏭)/) ?? m7.match(/(🔥|📌|⏭)\s*\**\s*(필독|참고|패스)/);
  const emo = pick?.[1];
  const rel = m7.match(/평소\s*대비[^\n]{0,30}?(강함|약함|평소)/);
  const baseLine = m8.split("\n").find((l) => /기준/.test(l) && /%/.test(l) && /\|/.test(l));
  const pcts = baseLine ? [...baseLine.matchAll(/([+-−]?\d+(?:\.\d+)?)\s*%/g)] : [];
  const last = pcts.at(-1)?.[1].replace("−", "-");
  return {
    conviction: conv ? Number(conv[1]) : null,
    verdict: emo === "🔥" ? "필독" : emo === "📌" ? "참고" : emo === "⏭" ? "패스" : null,
    relative: (rel?.[1] as Relative | undefined) ?? null,
    baseUpside: last != null ? Number(last) / 100 : null,
  };
}
