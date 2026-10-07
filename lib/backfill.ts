import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "./profiles";
import type { ReportMeta } from "./report-input";
import type { Relative, VerdictLabel } from "./verdicts";
import type { AnalysisContext } from "./analysis-context";
import { ANALYSIS_MODEL, THINKING_OFF } from "./model";
import { POSITIVE_ODDS_RULE } from "./brief";

// 과거 리포트 일괄 판정: 앱의 모듈 7(확신도)·8-2(기준 시나리오) 기준만 짧게, JSON으로 받는다.
// 실시간 분석과 같은 모델로 판정해야 "AI 판정 검증" 통계가 한 모델 기준이 된다
export const BACKFILL_MODEL = ANALYSIS_MODEL;
// 모델 학습 이후에 나온 리포트만 써야 "답을 알고 푸는" 오염을 피한다
// Sonnet 5.5는 4.6보다 최근까지 학습해, 기준을 2025-09-01에서 2026-07-01로 늦췄다
export const FAIR_SINCE = "2026-07-01";

export type BackfillResult = {
  conviction: number;
  relative: Relative;
  verdict: VerdictLabel;
  positiveOdds: number; // 0~100, 브리핑과 같은 정의 — 필독·참고·패스는 이 점수의 상대 순위로 정한다 (lib/score-tiers.ts)
  valuation: Valuation;
  reason: string;
  evidence: string[];
};

// 상승여력은 모델이 계산하지 않고 재료만 뽑는다 (첫 일괄 판정은 계산을 포기하고 54건 모두 null이었다)
export type Valuation = {
  price: number | null; // 발간일(또는 리포트 기준일) 주가, 원
  eps: number | null; // 기준 시나리오에 쓸 연도의 추정 EPS, 원
  epsYear: string | null;
  bps: number | null;
  targetPer: number | null; // 과거 밴드 중앙값 또는 피어 평균 PER (배)
  targetPbr: number | null;
  basis: string; // 어떤 멀티플을 왜 골랐는지 한 줄
};

const num = (description: string) => ({ anyOf: [{ type: "number" }, { type: "null" }], description });

// PER(이익 흑자) 우선, 안 되면 PBR. 단위 실수로 터무니없는 값이 나오면 버린다.
export function upsideFrom(v?: Valuation | null): number | null {
  if (!v?.price || v.price <= 0) return null;
  const fair = v.eps && v.eps > 0 && v.targetPer && v.targetPer > 0 ? v.eps * v.targetPer : v.bps && v.bps > 0 && v.targetPbr && v.targetPbr > 0 ? v.bps * v.targetPbr : null;
  if (fair == null) return null;
  const u = fair / v.price - 1;
  return u > -0.95 && u < 3 ? u : null;
}

export const BACKFILL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["conviction", "relative", "verdict", "positiveOdds", "valuation", "reason", "evidence"],
  properties: {
    conviction: { type: "number", description: "확신도 1~5 (0.5 단위)" },
    relative: { type: "string", enum: ["강함", "평소", "약함"], description: "작성 애널 평소 톤 대비" },
    verdict: { type: "string", enum: ["필독", "참고", "패스"] },
    positiveOdds: { type: "number", description: "0~100. 6~12개월 안에 리포트 핵심 투자포인트가 실적·공시로 확인될 가능성" },
    valuation: {
      type: "object",
      additionalProperties: false,
      required: ["price", "eps", "epsYear", "bps", "targetPer", "targetPbr", "basis"],
      description: "기준 시나리오 적정주가 계산 재료. 리포트 표·본문에 있는 숫자만, 없으면 null",
      properties: {
        price: num("발간일 기준 주가(원). 표지 '현재주가'·'주가' 칸"),
        eps: num("기준 시나리오에 쓸 연도(보통 올해 또는 내년)의 추정 EPS(원). 실적 추정표"),
        epsYear: { anyOf: [{ type: "string" }, { type: "null" }], description: "EPS 연도 (예: 2026F)" },
        bps: num("같은 연도 추정 BPS(원)"),
        targetPer: num("기준 시나리오 PER(배): 과거 PER 밴드 중앙값 또는 피어 평균 PER"),
        targetPbr: num("기준 시나리오 PBR(배): 과거 PBR 밴드 중앙값 또는 피어 평균 PBR"),
        basis: { type: "string", description: "어떤 멀티플을 왜 골랐는지 한 줄" },
      },
    },
    reason: { type: "string", description: "판정 이유 한두 문장" },
    evidence: { type: "array", items: { type: "string" }, description: "근거가 된 본문 원문 인용 최대 3개" },
  },
} as const;

// ctx는 발간일 기준으로 알 수 있었던 성적·이력만 담는다 (analysis-context.ts). 오늘 날짜는 넣지 않는다 — 사후 정보를 부르지 않게.
export function buildVerdictPrompt(
  report: ReportMeta,
  profile: Profile | undefined,
  analyst: string | null,
  text: string,
  ctx?: Pick<AnalysisContext, "trackRecord" | "history">
) {
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
    ...(ctx?.trackRecord
      ? [`- 작성자의 과거 리포트 성과 (발간일 종가 → 시장 대비 초과수익, 이 리포트 발간 전에 결과가 확정된 것만): ${ctx.trackRecord}`]
      : []),
    ...(ctx?.history?.length ? [`- 이 종목(작성자 무관)의 이전 KIRS 리포트 — 제목만, 내용 추측 금지: ${ctx.history.join(" / ")}`] : []),
    ``,
    `[판정 기준]`,
    `- 확신 신호: 단정형 서술, 강조 어휘(독보적·유일·원년·사상 최대·본격화·가시화 등), 숫자로 뒷받침된 주장, 요약·결론의 반복 강조.`,
    `- 유보 신호: "~할 전망/가능성/기대/예상", 조건부 서술, 숫자 없는 옵션.`,
    `- 리스크 서술이 짧고 형식적이면 확신 높음, 길고 구체적이면 경계 신호.`,
    `- 과거 성과가 시장 대비 부진한 애널(평균 초과수익 음수·승률 50% 미만, 표본 10건 이상)의 강한 톤은 한 단계 할인하세요.`,
    `- conviction(1~5), relative(평소 톤 대비 강함/평소/약함), verdict(필독/참고/패스)를 정하세요.`,
    `- positiveOdds: ${POSITIVE_ODDS_RULE}`,
    `- valuation: 기준 시나리오 적정주가 계산 재료만 적으세요(계산은 하지 않음). 주가·EPS·BPS는 원 단위, PER·PBR은 배. 적자라 PER을 못 쓰면 eps·targetPer는 null로 두고 PBR 재료를 적으세요.`,
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
    thinking: THINKING_OFF,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: { type: "json_schema", schema: BACKFILL_SCHEMA as unknown as Record<string, unknown> } },
  };
}

// 배치 가격(50% 할인) 기준 대략 비용 (USD). 한국어는 대략 1.5자 ≈ 1토큰으로 어림.
// 단가는 Sonnet 4.6 기준($3/$15 per MTok) 어림값 — 실제 청구는 Anthropic 콘솔에서 확인.
export function estimateCostUSD(promptChars: number[]) {
  const inTok = promptChars.reduce((a, b) => a + b / 1.5, 0);
  const outTok = promptChars.length * 700;
  return ((inTok * 3 + outTok * 15) / 1e6) * 0.5;
}
