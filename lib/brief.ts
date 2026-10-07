import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "./profiles";
import type { ReportMeta } from "./report-input";

// 팝업 상단 "바이사이드 냉정 브리핑" 프롬프트·스키마. 생성·캐시는 brief-service.ts
export const BRIEF_MODEL = "claude-sonnet-4-6";

export type Brief = {
  headline: string; // 한 줄 냉정 판단
  priority: "상" | "중" | "하"; // 바이사이드 검토 우선순위
  verdict: "필독" | "참고" | "패스";
  conviction: number; // 작성 애널 확신도 1~5
  positiveOdds: number; // 0~100: 6~12개월 안에 핵심 논리가 실적·공시로 확인될 가능성
  oddsReason: string;
  whyLook: { point: string; evidence: string; soWhat: string }[]; // 봐야 할 이유
  deepDive: { issue: string; why: string; check: string }[]; // 깊게 검토할 부분
  bullConditions: string[]; // 긍정 결론으로 가려면 필요한 조건
  killers: string[]; // 논리를 깨는 조건
  redFlags: string[]; // 리포트가 말하지 않거나 짧게 넘긴 것
  lensNote: string; // 작성 애널 성향·적중률을 감안한 할인 포인트
};

const str = (description: string) => ({ type: "string", description });
const strArr = (description: string) => ({ type: "array", items: { type: "string" }, description });

export const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline", "priority", "verdict", "conviction", "positiveOdds", "oddsReason",
    "whyLook", "deepDive", "bullConditions", "killers", "redFlags", "lensNote",
  ],
  properties: {
    headline: str("바이사이드 PM에게 던지는 한 줄 냉정 판단 (40자 안팎)"),
    priority: { type: "string", enum: ["상", "중", "하"], description: "지금 시간을 들여 검토할 우선순위" },
    verdict: { type: "string", enum: ["필독", "참고", "패스"] },
    conviction: { type: "number", description: "작성 애널의 확신도 1~5 (0.5 단위)" },
    positiveOdds: { type: "number", description: "0~100. 6~12개월 안에 리포트 핵심 논리가 실적·공시로 확인될 가능성" },
    oddsReason: str("그 확률을 준 이유 2~3문장"),
    whyLook: {
      type: "array",
      description: "바이사이드가 이 종목을 진짜 검토해봐야 할 핵심 포인트 2~4개",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["point", "evidence", "soWhat"],
        properties: {
          point: str("포인트 한 줄"),
          evidence: str("근거가 되는 본문 원문 인용 또는 수치"),
          soWhat: str("그래서 주가·밸류에 왜 중요한가"),
        },
      },
    },
    deepDive: {
      type: "array",
      description: "깊게 파봐야 할 부분 2~4개",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issue", "why", "check"],
        properties: {
          issue: str("검토 쟁점"),
          why: str("왜 위험하거나 불확실한가"),
          check: str("무엇을 어떻게 확인할지 (공시·IR 질문·데이터)"),
        },
      },
    },
    bullConditions: strArr("긍정적 결론으로 가려면 충족돼야 할 조건 2~4개"),
    killers: strArr("이것이 확인되면 논리가 깨지는 조건 2~3개"),
    redFlags: strArr("리포트가 말하지 않거나 짧게 넘긴 경고 신호 1~3개"),
    lensNote: str("작성 애널의 평소 성향·과거 적중률을 감안해 무엇을 할인해서 읽어야 하는지"),
  },
} as const;

export type BriefContext = {
  report: ReportMeta;
  analyst: string | null;
  ra: string | null;
  profile?: Profile;
  pdfText: string;
  trackRecord?: string | null; // 성적표 요약 한 줄
  history?: string | null; // 이 종목 KIRS 리포트 이력 요약
  daysSince?: number | null;
  today?: string;
};

export function buildBriefPrompt(c: BriefContext): string {
  const lens = c.profile
    ? `${c.profile.name} — ${c.profile.type} / 스탠스: ${c.profile.stance} / 원퀘스천: ${c.profile.oneQuestion} / 주의·검증: ${c.profile.caution}`
    : `${c.analyst ?? c.report.author} (DB 미등록)`;
  return [
    `당신은 한국 중소형주를 다루는 바이사이드(운용사) 시니어 애널리스트입니다. 셀사이드 리포트를 읽고 PM에게 "지금 시간을 들여 검토할 가치가 있는가"를 냉정하게 보고합니다.`,
    `응원하지 마세요. 리포트의 긍정적 서술을 그대로 옮기지 말고, 숫자로 확인되는 것과 기대에 불과한 것을 구분하세요.`,
    ``,
    `[전제]`,
    `- 한국IR협의회(KIRS) 리포트는 투자의견·목표주가가 없는 기업 분석 자료로, 기업 소개 성격 때문에 긍정 편향이 있을 수 있습니다.`,
    `- positiveOdds는 "6~12개월 안에 리포트의 핵심 투자포인트가 실적·공시로 확인될 가능성"입니다. 50은 동전 던지기이고, 70 이상은 숫자로 이미 확인되는 근거가 탄탄할 때만 주세요. 근거가 기대·전망뿐이면 40 이하가 기본입니다.`,
    `- evidence에는 본문에 실제로 있는 문장·수치만 쓰고, 없는 사실을 만들지 마세요.`,
    ``,
    `[대상]`,
    `- 종목: ${c.report.name}${c.report.code ? ` (${c.report.code})` : ""} · 제목: ${c.report.title}`,
    `- 발간일: ${c.report.date}${c.daysSince != null ? ` (발간 후 ${c.daysSince}일 — 그 사이 변동 가능성 감안)` : ""}`,
    ...(c.today ? [`- 오늘 날짜: ${c.today}`] : []),
    `- 작성자: ${c.analyst ?? c.report.author}${c.ra ? ` / RA: ${c.ra}` : ""}`,
    `- 작성 애널 프로파일: ${lens}`,
    ...(c.trackRecord ? [`- 이 애널 리포트의 과거 성과(발간일 종가 → 이후 시장 대비 초과수익, 이 리포트 발간 전에 결과가 확정된 것만): ${c.trackRecord}`] : []),
    ...(c.history ? [`- 이 종목 KIRS 리포트 이력: ${c.history}`] : []),
    ``,
    `[리포트 본문]`,
    `"""`,
    c.pdfText,
    `"""`,
  ].join("\n");
}

export async function generateBrief(prompt: string): Promise<Brief> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: BRIEF_MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema: BRIEF_SCHEMA as unknown as Record<string, unknown> } },
  });
  if (msg.stop_reason === "refusal") throw new Error("모델이 이 리포트 판단을 거절했어요.");
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("브리핑 응답이 비어 있어요.");
  const b = JSON.parse(block.text) as Brief;
  b.positiveOdds = Math.max(0, Math.min(100, Math.round(b.positiveOdds)));
  b.conviction = Math.max(1, Math.min(5, b.conviction));
  return b;
}
