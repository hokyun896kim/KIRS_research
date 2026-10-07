import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getReportIndex } from "./history";
import { getContextSnapshot } from "./context-snapshot";
import { getAnalystFacts } from "./analyst-facts";
import { loadReport } from "./report-input";
import { PROFILES, matchProfile, type Profile } from "./profiles";
import { putJson, readJson } from "./verdicts";
import { pool } from "./pool";
import { ANALYSIS_MODEL, THINKING_OFF } from "./model";
import type { Report } from "./kirs";

// 애널 프로필 재검증 작업 (일회성, 관리자 전용)
// 1) submit: 애널마다 리포트 8건을 골라 본문에서 문체·논리 습관을 뽑는 배치 제출
// 2) sync: 배치 결과(리포트별 관찰)를 Blob에 모음
// 3) propose: 애널별 관찰 8건 + 기존 프로필로 새 프로필 제안 (바로 반영하지 않고 사람이 비교 후 승인)

export const TARGETS = [...PROFILES.map((p) => p.name), "오정하", "권지승"];
const PER_ANALYST = 8;
const MAX_CHARS = 45_000; // 본문이 길면 앞부분(요약·투자포인트·재무 앞쪽)만
const STATE = "profiles/v1/state.json";
const PROPOSAL = "profiles/v1/proposal.json";
const obsPath = (batchId: string) => `profiles/v1/obs/${batchId}.json`;

export type SampleRef = { no: string; author: string; name: string; title: string; date: string; pdfUrl: string; why: string };
export type JobState = { batches: { id: string; group: number; samples: SampleRef[]; createdAt: string; synced?: boolean }[] };
export type Observation = {
  structure: string;
  keyPhrases: string[];
  convictionSignals: string[];
  hedgeSignals: string[];
  riskStyle: string;
  valuation: string;
  emphasis: string;
  blindSpots: string;
  toneLevel: number;
  coAuthor: string | null;
};
export type ObsRecord = SampleRef & { obs: Observation };

const str = (description: string) => ({ type: "string", description });
const strArr = (description: string) => ({ type: "array", items: { type: "string" }, description });

const OBS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["structure", "keyPhrases", "convictionSignals", "hedgeSignals", "riskStyle", "valuation", "emphasis", "blindSpots", "toneLevel", "coAuthor"],
  properties: {
    structure: str("리포트 논리 전개 순서를 화살표로 (예: 산업 구조→기술 해자→실적→밸류)"),
    keyPhrases: strArr("이 작성자가 쓴 특징적 표현·키워드 5~8개, 본문 그대로"),
    convictionSignals: strArr("확신·단정 표현 원문 2~4개"),
    hedgeSignals: strArr("유보·조건부 표현 원문 2~4개"),
    riskStyle: str("리스크 서술의 분량·구체성(숫자·시점 유무)과 위치"),
    valuation: str("밸류에이션 방법과 근거(멀티플·피어·밴드), 없으면 '없음'"),
    emphasis: str("가장 힘준 논점 한두 문장"),
    blindSpots: str("다루지 않거나 짧게 넘긴 것"),
    toneLevel: { type: "number", description: "전체 확신 톤 1(유보)~5(강한 확신)" },
    coAuthor: { anyOf: [{ type: "string" }, { type: "null" }], description: "표지·본문에 RA·공동작성자가 있으면 이름, 없으면 null" },
  },
} as const;

function obsPrompt(s: SampleRef, text: string) {
  return [
    `한국IR협의회 기업리서치센터 리포트 한 편을 읽고, 작성 애널리스트(${s.author})의 "쓰는 습관"을 관찰해 기록하세요.`,
    `종목 평가나 투자 판단이 아니라 문체·논리 전개·확신 표현·리스크 서술 방식 같은 작성 성향만 봅니다.`,
    `인용은 본문에 실제로 있는 문장만 쓰고, 발간일 이후의 주가·실적 정보는 절대 쓰지 마세요.`,
    ``,
    `[리포트] ${s.name} · "${s.title}" · ${s.date} · 작성 ${s.author}`,
    `"""`,
    text.slice(0, MAX_CHARS),
    `"""`,
  ].join("\n");
}

// 애널마다 고르는 기준: 최근 3 · 가장 오래된 2 · 6개월 초과수익 최고·최저 각 1 · 나머지는 중간에서 고르게
async function pickSamples(authors: string[]): Promise<SampleRef[]> {
  const [index, snap] = await Promise.all([getReportIndex(), getContextSnapshot()]);
  const e6 = new Map<string, number>();
  for (const [a, d, , x] of snap?.track ?? []) if (x != null) e6.set(`${a}|${d}`, x);
  const out: SampleRef[] = [];
  for (const author of authors) {
    const list = index
      .filter((r): r is Report & { no: string; pdfUrl: string } => !!r.no && !!r.pdfUrl && r.author.split(/[,\s]+/).includes(author))
      .sort((a, b) => a.date.localeCompare(b.date));
    const chosen = new Map<string, string>();
    const add = (r: (typeof list)[number] | undefined, why: string) => {
      if (r && !chosen.has(r.no) && chosen.size < PER_ANALYST) chosen.set(r.no, why);
    };
    list.slice(-3).reverse().forEach((r) => add(r, "최근"));
    list.slice(0, 2).forEach((r) => add(r, "초기"));
    const scored = list.filter((r) => e6.has(`${author}|${r.date}`)).sort((a, b) => e6.get(`${author}|${b.date}`)! - e6.get(`${author}|${a.date}`)!);
    add(scored[0], "6개월 성과 최고");
    add(scored.at(-1), "6개월 성과 최저");
    for (let k = 1; k <= PER_ANALYST; k++) add(list[Math.floor((list.length * k) / (PER_ANALYST + 1))], "중간");
    list.forEach((r) => add(r, "중간")); // 그래도 모자라면 남은 것 아무거나 (리포트가 8건 미만이면 전부)
    for (const [no, why] of chosen) {
      const r = list.find((x) => x.no === no)!;
      out.push({ no, author, name: r.name, title: r.title, date: r.date, pdfUrl: r.pdfUrl, why });
    }
  }
  return out;
}

export const getJobState = async () => (await readJson<JobState>(STATE)) ?? { batches: [] };

export async function submitGroup(group: number, groups: number, dryRun: boolean) {
  const authors = TARGETS.filter((_, i) => i % groups === group);
  const samples = await pickSamples(authors);
  if (dryRun) return { authors, samples: samples.length, perAuthor: Object.fromEntries(authors.map((a) => [a, samples.filter((s) => s.author === a).length])) };

  const loaded = await pool(samples, 6, async (s) => {
    try {
      const L = await loadReport(s.pdfUrl, { name: s.name, code: null, title: s.title, date: s.date, author: s.author });
      return { s, prompt: obsPrompt(s, L.text) };
    } catch {
      return null;
    }
  });
  const reqs = loaded.filter((x): x is { s: SampleRef; prompt: string } => !!x);
  const chars = reqs.reduce((a, r) => a + r.prompt.length, 0);
  const client = new Anthropic();
  const batch = await client.messages.batches.create({
    requests: reqs.map((r) => ({
      custom_id: `p${r.s.no}`,
      params: {
        model: ANALYSIS_MODEL,
        max_tokens: 2500,
        thinking: THINKING_OFF,
        messages: [{ role: "user", content: r.prompt }],
        output_config: { format: { type: "json_schema", schema: OBS_SCHEMA as unknown as Record<string, unknown> } },
      },
    })),
  });
  const state = await getJobState();
  state.batches.push({ id: batch.id, group, samples: reqs.map((r) => r.s), createdAt: new Date().toISOString() });
  await putJson(STATE, state);
  return { batchId: batch.id, authors, submitted: reqs.length, failedToLoad: samples.length - reqs.length, promptChars: chars };
}

export async function syncBatches() {
  const client = new Anthropic();
  const state = await getJobState();
  const report: unknown[] = [];
  for (const b of state.batches) {
    if (b.synced) {
      report.push({ id: b.id, status: "synced" });
      continue;
    }
    const info = await client.messages.batches.retrieve(b.id);
    if (info.processing_status !== "ended") {
      report.push({ id: b.id, status: info.processing_status, counts: info.request_counts });
      continue;
    }
    const byNo = new Map(b.samples.map((s) => [s.no, s]));
    const recs: ObsRecord[] = [];
    let failed = 0;
    for await (const r of await client.messages.batches.results(b.id)) {
      const s = byNo.get(r.custom_id.slice(1));
      if (r.result.type !== "succeeded" || !s) {
        failed++;
        continue;
      }
      const block = r.result.message.content.find((c) => c.type === "text");
      try {
        recs.push({ ...s, obs: JSON.parse(block && block.type === "text" ? block.text : "") as Observation });
      } catch {
        failed++;
      }
    }
    await putJson(obsPath(b.id), recs);
    b.synced = true;
    report.push({ id: b.id, status: "ended", saved: recs.length, failed });
  }
  await putJson(STATE, state);
  return report;
}

async function allObservations(): Promise<ObsRecord[]> {
  const state = await getJobState();
  const lists = await Promise.all(state.batches.filter((b) => b.synced).map((b) => readJson<ObsRecord[]>(obsPath(b.id))));
  return lists.flatMap((l) => l ?? []);
}

// ── 2단계: 애널별 새 프로필 제안 ──
const STANCES = ["구조확신형", "조건부기대형", "발굴소개형", "턴어라운드기대형", "이벤트대기형"];

const PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "stance", "ratio", "keyword", "strength", "caution", "oneQuestion", "guide", "bestStock", "sectors", "signals", "warn", "changes", "confidence"],
  properties: {
    type: str("유형 이름 (예: 산업해설형). 기존 이름이 맞으면 유지"),
    stance: str(`스탠스: ${STANCES.join("/")} 중 하나 + 괄호 안 비중 (예: 구조확신형 (지형60/트리거40))`),
    ratio: str("지형/트리거 비중 'NN/NN' (지형이 앞)"),
    keyword: str("문법·키워드: 논리 전개 화살표 + 자주 쓰는 표현 3~5개"),
    strength: str("이 애널 리포트에서 믿을 만한 부분 (짧게)"),
    caution: str("읽을 때 할인하거나 따로 확인할 부분 (짧게)"),
    oneQuestion: str("이 애널 리포트를 읽을 때 던질 질문 하나 (짧은 구어체)"),
    guide: str("한 줄 지침 (두 문장 이내)"),
    bestStock: str("이 애널 렌즈가 잘 맞는 종목 유형"),
    sectors: strArr("강한 섹터·종목 유형 1~3개"),
    signals: strArr("'~하면 → 의미 → 대응' 형식의 읽기 신호 2~4개"),
    warn: { type: "boolean", description: "표본이 적거나 공동작성 영향이 커서 관찰 프로필로 둘지" },
    changes: strArr("기존 프로필 대비 바꾼 점과 근거(어느 리포트 관찰인지) 2~5개. 새 애널이면 근거 요약"),
    confidence: { type: "string", enum: ["상", "중", "하"], description: "관찰이 프로필을 얼마나 뒷받침하는지" },
  },
} as const;

export type ProposedProfile = Omit<Profile, "name" | "no"> & { changes: string[]; confidence: "상" | "중" | "하" };
export type Proposal = { createdAt: string; model: string; profiles: Record<string, ProposedProfile & { samples: number }> };

function proposePrompt(author: string, cur: Profile | undefined, recs: ObsRecord[], facts: unknown) {
  return [
    `당신은 한국IR협의회 리포트 작성 애널리스트별 "읽기 렌즈" 프로필을 관리합니다. 아래 관찰을 근거로 ${author}의 프로필을 다시 써 주세요.`,
    `규칙:`,
    `- 프로필은 작성 습관(논리 전개·강조·확신/유보 표현·리스크 서술)만 묘사합니다. 주가 성과·적중률 숫자는 쓰지 마세요 (성과는 앱이 발간일 기준으로 따로 붙입니다).`,
    `- 관찰 여러 건에서 반복되는 패턴만 프로필에 넣고, 한 건에만 나온 특징은 넣지 마세요.`,
    `- 기존 프로필과 맞는 부분은 표현을 유지하고, 관찰과 어긋나는 부분만 고치세요. 바꾼 이유를 changes에 적으세요.`,
    `- 스탠스는 ${STANCES.join(", ")} 중 하나로 고르세요.`,
    ``,
    cur ? `[기존 프로필]\n${JSON.stringify({ ...cur, no: undefined, name: undefined }, null, 1)}` : `[기존 프로필] 없음 — 도감에 새로 들어갈 애널입니다.`,
    ``,
    `[데이터 사실] ${JSON.stringify(facts)}`,
    ``,
    `[리포트별 관찰 ${recs.length}건]`,
    ...recs.map((r, i) => `(${i + 1}) ${r.date} ${r.name} "${r.title}" [선정: ${r.why}]\n${JSON.stringify(r.obs)}`),
  ].join("\n");
}

export async function proposeProfiles(only?: string[]) {
  const [recs, facts] = await Promise.all([allObservations(), getAnalystFacts()]);
  const authors = TARGETS.filter((a) => (!only?.length || only.includes(a)) && recs.some((r) => r.author === a));
  const client = new Anthropic();
  const results = await pool(authors, 4, async (author) => {
    const mine = recs.filter((r) => r.author === author);
    const f = facts[author];
    const msg = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 4000,
      thinking: THINKING_OFF,
      messages: [
        {
          role: "user",
          content: proposePrompt(author, matchProfile(author), mine, f && { reports: f.reports, first: f.first, last: f.last, sectors: f.sectors }),
        },
      ],
      output_config: { format: { type: "json_schema", schema: PROFILE_SCHEMA as unknown as Record<string, unknown> } },
    });
    const block = msg.content.find((c) => c.type === "text");
    return { author, p: JSON.parse(block && block.type === "text" ? block.text : "{}") as ProposedProfile, samples: mine.length };
  });
  const prev = (await readJson<Proposal>(PROPOSAL)) ?? { createdAt: "", model: ANALYSIS_MODEL, profiles: {} };
  for (const r of results) prev.profiles[r.author] = { ...r.p, samples: r.samples };
  prev.createdAt = new Date().toISOString();
  prev.model = ANALYSIS_MODEL;
  await putJson(PROPOSAL, prev);
  return { proposed: results.map((r) => r.author), skipped: TARGETS.filter((a) => !authors.includes(a)) };
}

export const getProposal = () => readJson<Proposal>(PROPOSAL);
export const getObservations = allObservations;
