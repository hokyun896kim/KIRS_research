import type { Profile } from "./profiles";

export type PromptInput = {
  guideline: string; // guideline.md 전문
  report: { name: string; code?: string | null; title: string; date: string; author: string };
  analyst: string | null; // PDF에서 식별된 주 애널
  ra: string | null; // PDF에서 식별된 보조(RA)
  profile?: Profile; // 주렌즈
  raProfile?: Profile; // 보조렌즈
  pdfText: string;
  mode: "full" | "trade";
  sector?: string; // 자동분류 섹터 (힌트)
};

function daysSince(dateStr: string): number | null {
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  return Math.floor((Date.now() - d) / 86400000);
}

export function buildPrompt(i: PromptInput): string {
  const { report, profile, raProfile, analyst, ra } = i;
  const code = report.code ? ` (${report.code})` : "";
  const days = daysSince(report.date);
  const aged = days != null && days >= 30 ? `  ⚠ 발간 후 ${days}일 경과 — 공시·실적·시장 변동 확인 필요` : "";
  const coAuthored = !!(profile && raProfile);

  const profileBlock = profile
    ? [
        `- 적용 프로파일(주렌즈): ${profile.name} — ${profile.type} / 스탠스: ${profile.stance}${profile.warn ? "  ⚠관찰프로파일" : ""}`,
        `    · 원퀘스천: ${profile.oneQuestion}`,
        `    · 한 줄 지침: ${profile.guide}`,
        `    · 문법·키워드: ${profile.keyword}`,
        `    · 주의/검증: ${profile.caution}`,
      ].join("\n")
    : "- 적용 프로파일: (DB 미등록 — STEP 0.2에 따라 문법·키워드로 14인 중 유사 유형 추정 후 임시 프로파일 생성)";

  const raLine = ra
    ? raProfile
      ? `- 보조렌즈(RA): ${raProfile.name} — ${raProfile.type} / 원퀘스천: ${raProfile.oneQuestion}`
      : `- 보조렌즈(RA): ${ra} (DB 미등록)`
    : null;

  const modeLine =
    i.mode === "trade"
      ? "- 출력 모드: 매매모드 — 모듈 1~5 전부 + 모듈 6(가격 프레이밍) 추가. 현재가·52주 고저·밸류는 최신 웹검색으로 보강."
      : "- 출력 모드: 풀모드 — 모듈 1~5 전부.";

  const stepLine = profile
    ? "위 작성자를 STEP 0 규칙으로 식별했고, STEP 1의 14인 표에서 해당 행을 주렌즈로 적용합니다." +
      (coAuthored ? " 공동작성(주렌즈+보조렌즈)이며, 표본/공동작성 영향이 크면 ⚠관찰프로파일로 처리하세요." : "")
    : "위 작성자를 STEP 0 규칙으로 식별했고, STEP 1의 14인 표에서 해당 행을 추정 적용합니다.";

  const SEP = "─".repeat(34);

  return [
    `당신은 한국IR협의회 리서치 보고서를 "작성 애널리스트별 뷰"로 해석하는 분석가입니다.`,
    `아래 [실행 지침]을 그대로 적용해, 지정된 모듈을 순서대로 한국어로 출력하세요.`,
    ``,
    SEP,
    `[실행 지침]`,
    SEP,
    i.guideline,
    ``,
    SEP,
    `[이번 분석 대상]`,
    SEP,
    `- 종목: ${report.name}${code} · 추정 섹터: ${i.sector ?? "기타"}`,
    `- 제목: ${report.title}`,
    `- 발간일: ${report.date}${aged}`,
    `- 작성자(Analyst): ${analyst ?? report.author}${ra ? ` / RA: ${ra}` : ""}`,
    profileBlock,
    ...(raLine ? [raLine] : []),
    modeLine,
    ``,
    `[STEP 0 / STEP 1 적용]`,
    stepLine,
    ``,
    `지시:`,
    `1) 먼저 공통 3대 필터(본업 vs 옵션 / 시간축 / 밸류+촉매)를 적용해 모듈 1·3에 반영하세요.`,
    i.mode === "trade" ? `2) 모듈 1~5를 출력한 뒤 모듈 6을 자동 실행하세요.` : `2) 모듈 1~5를 모두 출력하세요.`,
    `3) 모듈 2는 원퀘스천으로 시작하세요.`,
    `4) 신뢰/검증 영역은 이 리포트의 구체 내용으로 작성하고 일반론은 금지합니다.`,
    `5) 모듈 4의 [B], 필터 3-B는 답하지 말고 "사용자확인"으로 표시하세요.`,
    `6) 추측과 분석을 구분하고, 불확실한 숫자는 "확실하지 않음"으로 표시하세요.`,
    ``,
    SEP,
    `[리포트 본문]`,
    SEP,
    `"""`,
    i.pdfText,
    `"""`,
  ].join("\n");
}
