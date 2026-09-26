import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "./profiles";
import type { ReportMeta } from "./report-input";
import type { Relative, VerdictLabel } from "./verdicts";

// 과거 리포트 일괄 판정: 앱의 모듈 7(확신도)·8-2(기준 시나리오) 기준만 짧게, JSON으로 받는다.
export const BACKFILL_MODEL = "claude-sonnet-4-6";
// 모델 학습 이후에 나온 리포트만 써야 "답을 알고 푸는" 오염을 피한다
export const FAIR_SINCE = "2025-09-01";

export type BackfillResult = {
  conviction: number;
  relative: Relative;
  verdict: VerdictLabel;
  baseUpside: number | null; // % (56.4 = +56.4%)
  reason: string;
  evidence: string[];
};

export const BACKFILL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["conviction", "relative", "verdict", "baseUpside", "reason", "evidence"],
  properties: {
    conviction: { type: "number", description: "확신도 1~5 (0.5 단위)" },
    relative: { type: "string", enum: ["강함", "평소", "약함"], description: "작성 애널 평소 톤 대비" },
    verdict: { type: "string", enum: ["필독", "참고", "패스"] },
    baseUpside: {
      anyOf: [{ type: "number" }, { type: "null" }],
      description: "기준 시나리오 적정주가의 발간일 주가 대비 % (예: 56.4). 근거 숫자가 없으면 null",
    },
    reason: { type: "string", description: "판정 이유 한두 문장" },
    evidence: { type: "array", items: { type: "string" }, description: "근거가 된 본문 원문 인용 최대 3개" },
  },
} as const;

export function buildVerdictPrompt(report: ReportMeta, profile: Profile | undefined, analyst: string | null, text: string) {
  const lens = profile
    ? `${profile.name} — ${profile.type} / 스탠스: ${profile.stance} / 원퀘스천: ${profile.oneQuestion} / 문법·키워드: ${profile.keyword}`
    : `${analyst ?? report.author} (DB 미등록 — 문체로 평소 톤을 추정)`;
  return [
    `당신은 한국IR협의회 리서치 보고서를 작성 애널리스트의 평소 톤과 비교해 "진짜 봐야 하는 리포트인가"를 판정하는 분석가입니다.`,
    ``,
    `[대상]`,
    `- 종목: ${report.name}${report.code ? ` (${report.code})` : ""}`,
    `- 제목: ${report.title}`,
    `- 발간일: ${report.date}`,
    `- 작성자 프로파일(평소 톤 기준선): ${lens}`,
    ``,
    `[판정 기준]`,
    `- 확신 신호: 단정형 서술, 강조 어휘(독보적·유일·원년·사상 최대·본격화·가시화 등), 숫자로 뒷받침된 주장, 요약·결론의 반복 강조.`,
    `- 유보 신호: "~할 전망/가능성/기대/예상", 조건부 서술, 숫자 없는 옵션.`,
    `- 리스크 서술이 짧고 형식적이면 확신 높음, 길고 구체적이면 경계 신호.`,
    `- conviction(1~5), relative(평소 톤 대비 강함/평소/약함), verdict(필독/참고/패스)를 정하세요.`,
    `- baseUpside: 리포트 속 밸류 근거(과거 밴드 중앙값 또는 피어 평균 멀티플 × 추정 EPS/BPS)로 기준 시나리오 적정주가를 구해 발간일 주가 대비 %로. 근거 숫자가 없으면 null.`,
    `- evidence는 본문에 실제로 있는 문장만 인용하세요.`,
    ``,
    `중요: 이 종목의 발간일 이후 주가·실적·뉴스를 알고 있더라도 절대 반영하지 말고, 아래 리포트 본문만으로 판단하세요.`,
    ``,
    `[리포트 본문]`,
    `"""`,
    text,
    `"""`,
  ].join("\n");
}

export const customIdFor = (no: string) => `r${no.replace(/[^0-9A-Za-z_-]/g, "")}`;
export const noFromCustomId = (id: string) => id.replace(/^r/, "");

export function batchParams(prompt: string): Anthropic.Messages.MessageCreateParamsNonStreaming {
  return {
    model: BACKFILL_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema: BACKFILL_SCHEMA as unknown as Record<string, unknown> } },
  };
}

// 배치 가격(50% 할인) 기준 대략 비용 (USD). 한국어는 대략 1.5자 ≈ 1토큰으로 어림.
export function estimateCostUSD(promptChars: number[]) {
  const inTok = promptChars.reduce((a, b) => a + b / 1.5, 0);
  const outTok = promptChars.length * 700;
  return ((inTok * 3 + outTok * 15) / 1e6) * 0.5;
}
