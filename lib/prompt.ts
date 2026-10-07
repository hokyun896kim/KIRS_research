import type { Profile } from "./profiles";
import type { AnalysisContext } from "./analysis-context";

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
  attachedPdf?: boolean; // true면 본문 텍스트 대신 첨부 PDF 원본을 읽게 함 (AI 자동분석)
  context?: AnalysisContext; // 오늘 날짜·작성 애널 과거 성과·이 종목 이력
};

function daysSince(dateStr: string, today?: string): number | null {
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = today?.match(/(\d{4})-(\d{2})-(\d{2})/);
  const now = t ? Date.UTC(+t[1], +t[2] - 1, +t[3]) : Date.now();
  return Math.floor((now - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
}

function agedNote(date: string, today?: string): string {
  const days = daysSince(date, today);
  return days != null && days >= 30 ? `  ⚠ 발간 후 ${days}일 경과 — 공시·실적·시장 변동 확인 필요` : "";
}

// [이번 분석 대상]에 붙는 참고 자료 줄. 이전 리포트는 제목만 주므로 내용을 추측하지 말라고 못 박는다.
function contextLines(c: AnalysisContext | undefined, author: string): string[] {
  if (!c) return [];
  return [
    `- 오늘 날짜: ${c.today}`,
    // 조회 실패(null)면 줄을 아예 뺀다 — "표본 부족"을 프로파일 표본 부족으로 오독하는 일이 있었다
    ...(c.trackRecord
      ? [
          `- ${author}의 과거 리포트 성과 (발간일 종가 → 소속 시장 대비 초과수익, 이 리포트 발간일 전에 결과가 확정된 것만): ${c.trackRecord}`,
        ]
      : c.trackRecord === ""
        ? [`- ${author}의 과거 리포트 성과: 결과가 확정된 리포트가 3건 미만이라 성과 보정은 생략 (프로파일 판단과는 무관)`]
        : []),
    ...(c.history == null
      ? []
      : c.history.length
        ? [
            `- 이 종목(작성자 무관)의 이전 KIRS 리포트 — 제목만 제공, 내용 추측 금지:`,
            ...c.history.map((h) => `    · ${h}`),
          ]
        : [`- 이 종목의 이전 KIRS 리포트: 없음 (이번이 첫 커버리지)`]),
  ];
}

// 성적표 "AI 판정 검증"이 읽는 고정 형식 마지막 줄 (lib/verdicts.ts parseVerdict)
const SUMMARY_LINE = [
  `### 마지막 줄 — 판정 요약 (형식 고정)`,
  `- 답변의 맨 마지막에 아래 형식 그대로 한 줄을 출력할 것. 값만 바꾸고 다른 말을 붙이지 말 것.`,
  `[판정요약] 판정=필독|참고|패스 · 확신도=N/5 · 평소대비=강함|평소|약함 · 기준업사이드=+NN.N%`,
  `- 기준업사이드는 모듈 8 기준 시나리오의 발간일 주가 대비 %. 계산할 수 없으면 "기준업사이드=확실하지않음".`,
];

// 지침(guideline.md)은 리포트 한 편 분석에 쓰는 부분만 남겼고, 앱 전용 모듈을 뒤에 붙인다.
function extraModules(mode: "full" | "trade"): string[] {
  return [
    `[추가 모듈 — 뉘앙스·상승여력]`,
    `### 모듈 7. 뉘앙스·확신도 판독 ("진짜 봐야 하는 리포트인가")`,
    `- 기준선: 위 적용 프로파일(유형·스탠스·문법)을 이 애널의 평소 톤으로 보고, 이번 리포트가 평소보다 강한지 / 평소 수준인지 / 약한지 판정.`,
    `- 성과 보정: [이번 분석 대상]의 과거 성과를 함께 볼 것. 시장 대비 부진한 애널의 강한 톤은 한 단계 할인하고, 성과가 좋은 애널이 평소보다 강하게 쓰면 가중. 보정했다면 이유를 한 줄로 적을 것.`,
    `- 확신 신호: 단정형 서술, 강조 어휘(독보적·유일·원년·사상 최대·본격화·가시화 등), 숫자로 뒷받침된 주장, 제목·요약(■)·결론에서 반복되는 강조 → 원문 그대로 인용 3~5개.`,
    `- 유보 신호: "~할 전망/가능성/기대/예상", 조건부 서술, 숫자 없는 옵션 → 원문 인용 2~4개.`,
    `- 리스크 서술: 분량과 구체성(숫자·시점 제시 여부). 짧고 형식적이면 확신 높음, 길고 구체적이면 경계 신호.`,
    `- 출력: "확신도 N/5 · 평소 대비 강함/평소/약함 · 판정 🔥필독 / 📌참고 / ⏭패스" 한 줄 + 이유 한 줄, 그리고 [신호 | 원문 인용 | 해석] 표.`,
    `- 인용은 본문에 실제로 있는 문장만 쓰고, 없는 말을 만들지 말 것.`,
    ``,
    `### 모듈 8. 내재 상승여력 역산`,
    `- 첫 줄에 명시: 한국IR협의회 리포트에는 목표주가·투자의견이 없으므로, 아래는 리포트 속 밸류 근거로 역산한 추정치이며 애널리스트 목표가가 아니다.`,
    `- 8-1 근거 표 [항목 | 수치 | 출처(표·문장, 쪽)]: 발간일 기준 주가·시가총액, 추정 EPS/BPS/순이익(연도 명시), 현재 PER/PBR, 과거 밴드(하단~상단), 피어 평균 멀티플, 리포트가 든 리레이팅 근거.`,
    `- 8-2 시나리오 표 [시나리오 | 적용 멀티플(근거) | 적정주가 | 발간일 주가 대비 %]:`,
    `  · 보수: 현 멀티플 유지 또는 밴드 하단·피어 하단`,
    `  · 기준: 밴드 중앙값 또는 피어 평균`,
    `  · 낙관: 리포트가 강조한 리레이팅 논리가 실현될 때(밴드 상단 등)`,
    `  각 시나리오의 계산식(멀티플 × EPS 또는 BPS)을 한 줄씩 보여줄 것.`,
    ...(mode === "trade"
      ? [`  · 매매모드: 웹검색으로 확인한 현재가 기준 % 열을 추가하고 조회 시점을 적을 것.`]
      : []),
    `- 8-3 실현 조건: 기준 시나리오에 필요한 촉매(필터 3-A), 사용자가 확인할 항목(3-B는 "사용자확인"), 하방 시나리오의 다운사이드 %.`,
    `- 8-4 모듈 7과 교차: 확신도는 높은데 업사이드가 작거나(이미 반영), 업사이드는 큰데 확신도가 낮은(근거 약함) 경우를 짚을 것.`,
    `- 필요한 숫자가 리포트에 없으면 지어내지 말고 "확실하지 않음"으로 두고, 계산 가능한 시나리오만 제시.`,
    ``,
    ...SUMMARY_LINE,
  ];
}

export function buildPrompt(i: PromptInput): string {
  const { report, profile, raProfile, analyst, ra } = i;
  const code = report.code ? ` (${report.code})` : "";
  const aged = agedNote(report.date, i.context?.today);
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
    ...contextLines(i.context, analyst ?? report.author),
    ``,
    `[STEP 0 / STEP 1 적용]`,
    stepLine,
    ``,
    `지시:`,
    `1) [실행 지침]의 운영 규칙(5장)을 그대로 따르세요.`,
    i.mode === "trade"
      ? `2) 출력 순서: 모듈 1~6 → [추가 모듈] 7·8 → 마지막 [판정요약] 한 줄.`
      : `2) 출력 순서: 모듈 1~5 → [추가 모듈] 7·8 → 마지막 [판정요약] 한 줄.`,
    `3) 오늘 날짜·과거 성과·이전 리포트는 판단 보조 자료입니다. 리포트 본문에 없는 사실을 지어내지 마세요.`,
    ``,
    ...extraModules(i.mode),
    ``,
    SEP,
    `[리포트 본문]`,
    SEP,
    ...(i.attachedPdf
      ? [`첨부한 PDF 원본을 직접 읽으세요. 재무 추정표·밸류에이션 표·차트의 숫자는 표에서 확인하고, 인용할 때는 쪽 번호를 적으세요.`]
      : [`"""`, i.pdfText, `"""`]),
  ].join("\n");
}

export type CounterPromptInput = Omit<PromptInput, "mode"> & { lens: Profile };

// 반론모드: 같은 리포트를 스탠스가 다른 애널의 렌즈로 다시 읽는다 (확증편향 방지).
export function buildCounterPrompt(i: CounterPromptInput): string {
  const { report, profile, analyst, ra, lens } = i;
  const code = report.code ? ` (${report.code})` : "";
  const aged = agedNote(report.date, i.context?.today);
  const SEP = "─".repeat(34);

  return [
    `당신은 한국IR협의회 리서치 보고서를 "반대편 애널리스트의 렌즈"로 반론 검토하는 분석가입니다.`,
    `아래 [실행 지침]의 프로파일·신호 체계를 참고하되, 이번에는 작성자의 렌즈가 아니라 지정된 반론 렌즈로 리포트를 다시 읽고 한국어로 출력하세요.`,
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
    profile
      ? `- 원작성 렌즈: ${profile.name} — ${profile.type} / 스탠스: ${profile.stance} / 원퀘스천: ${profile.oneQuestion}`
      : `- 원작성 렌즈: (DB 미등록 — 문체로 유형 추정)`,
    `- 반론 렌즈: ${lens.name} — ${lens.type} / 스탠스: ${lens.stance}`,
    `    · 원퀘스천: ${lens.oneQuestion}`,
    `    · 강점: ${lens.strength}`,
    `    · 주의/검증: ${lens.caution}`,
    `    · 문법·키워드: ${lens.keyword}`,
    `- 출력 모드: 반론모드`,
    ...contextLines(i.context, analyst ?? report.author),
    ``,
    `[반론 검토 지시]`,
    `1) 첫 줄은 반론 렌즈의 원퀘스천을 이 종목에 맞게 바꿔 던지며 시작하세요.`,
    `2) 핵심 주장 재검증 표 [원 리포트 주장(원문 인용, 쪽) | 반론 렌즈의 의문 | 리포트 안의 반박 근거 | 판정 🟢버팀 / 🟡약함 / 🔴무너짐] 4~6행.`,
    `3) 공백 점검: 반론 렌즈가 중요하게 보지만 리포트가 다루지 않거나 짧게 넘긴 것 3개.`,
    `4) 숫자 스트레스 테스트: 리포트 추정치 중 가장 취약한 가정 1~2개를 골라, 그 가정이 틀리면 실적·밸류가 어떻게 바뀌는지 계산식으로 (계산할 숫자가 없으면 "확실하지 않음").`,
    `5) 톤 비교: 원작성자 확신도 N/5 vs 반론 렌즈 기준 확신도 N/5, 차이가 나는 이유.`,
    `6) 결론: "원 렌즈: ○ / 반론 렌즈: ○ / 종합 판정: 🔥필독 · 📌참고 · ⏭패스" 한 줄 + 반론을 이겨내려면 확인할 체크리스트(사용자확인).`,
    `7) 반론을 위한 반론은 금지합니다. 리포트 근거가 탄탄하면 🟢로 인정하세요. 인용은 본문에 실제로 있는 문장만 쓰세요.`,
    ``,
    SEP,
    `[리포트 본문]`,
    SEP,
    ...(i.attachedPdf
      ? [`첨부한 PDF 원본을 직접 읽으세요. 재무 추정표·밸류에이션 표·차트의 숫자는 표에서 확인하고, 인용할 때는 쪽 번호를 적으세요.`]
      : [`"""`, i.pdfText, `"""`]),
  ].join("\n");
}

export type CompareSide = {
  report: PromptInput["report"];
  analyst: string | null;
  profile?: Profile;
  pdfText: string;
};

function monthsBetween(a: string, b: string): number | null {
  const pa = a.match(/(\d{4})-(\d{2})/), pb = b.match(/(\d{4})-(\d{2})/);
  if (!pa || !pb) return null;
  return Math.abs((+pa[1] - +pb[1]) * 12 + (+pa[2] - +pb[2]));
}

// 비교모드: 같은 종목의 이번 리포트와 이전 리포트를 나란히 놓고 "무엇이 바뀌었나"를 판독한다.
// PDF를 첨부할 때는 문서 1 = 이번, 문서 2 = 이전 순서로 넣는다.
export function buildComparePrompt(i: {
  current: CompareSide;
  previous: CompareSide;
  attachedPdf?: boolean;
  today?: string;
}): string {
  const { current: cur, previous: prev } = i;
  const SEP = "─".repeat(34);
  const code = cur.report.code ? ` (${cur.report.code})` : "";
  const gap = monthsBetween(cur.report.date, prev.report.date);
  const lens = (s: CompareSide) =>
    s.profile ? `${s.profile.name} — ${s.profile.type} / 원퀘스천: ${s.profile.oneQuestion}` : `${s.analyst ?? s.report.author} (DB 미등록)`;
  const sameAuthor = (cur.analyst ?? cur.report.author) === (prev.analyst ?? prev.report.author);

  return [
    `당신은 같은 종목에 대한 한국IR협의회 리포트 두 편을 비교해 "무엇이 바뀌었나"를 판독하는 분석가입니다. 한국어로 출력하세요.`,
    ``,
    SEP,
    `[비교 대상]`,
    SEP,
    `- 종목: ${cur.report.name}${code}`,
    `- 이번 리포트: ${cur.report.date} · "${cur.report.title}" · 작성 ${lens(cur)}`,
    `- 이전 리포트: ${prev.report.date} · "${prev.report.title}" · 작성 ${lens(prev)}`,
    `- 간격: ${gap != null ? `약 ${gap}개월` : "확실하지 않음"}${sameAuthor ? " · 같은 애널리스트" : " · 작성자가 바뀜"}`,
    ...(i.today ? [`- 오늘 날짜: ${i.today}${agedNote(cur.report.date, i.today)}`] : []),
    ``,
    `[비교 지시]`,
    `1) 첫 줄 요약: "이전 대비 ○○ — 톤 상향/유지/하향" 한 줄.`,
    `2) 추정치 변화 표 [항목(매출·영업이익·순이익·EPS·BPS, 연도별) | 이전 리포트 | 이번 리포트 | 변화 %]. 같은 연도끼리만 비교하고 단위를 맞추세요.`,
    `3) 이전 리포트 예측 채점: 이전 리포트가 전망했던 연도의 실적이 이번 리포트에 실적(A)으로 나와 있으면 [항목 | 이전 전망 | 실제 | 오차 %] 표로 채점하고, 적중·빗나감의 이유를 한 줄씩. 없으면 "확실하지 않음".`,
    `4) 투자포인트 변화: 유지된 논리 / 새로 등장한 논리 / 사라진 논리. 사라진 논리는 왜 빠졌는지 추정하고 "확인 필요"로 표시.`,
    `5) 톤·확신도 변화: 이전 N/5 → 이번 N/5, 강조 어휘와 유보 표현의 변화를 양쪽 원문 인용(쪽 번호)으로 대조.`,
    `6) 말 바뀜 경보: 이전에 강하게 주장했는데 이번에 약해지거나 뒤집힌 주장 [이전 인용 | 이번 인용 | 해석]. 없으면 "없음".`,
    ...(sameAuthor ? [] : [`7) 작성자가 바뀌었으므로, 렌즈(애널 성향) 차이 때문에 달라 보이는 부분과 기업 자체의 변화를 구분하세요.`]),
    `${sameAuthor ? "7" : "8"}) 결론: 변화 방향 ⬆개선 / ➡유지 / ⬇악화 + 이번 리포트에서 확인할 체크리스트(사용자확인).`,
    `인용은 두 리포트 본문에 실제로 있는 문장만 쓰고, 숫자가 없으면 지어내지 말고 "확실하지 않음"으로 표시하세요.`,
    ``,
    ...(i.attachedPdf
      ? [
          SEP,
          `[리포트 본문]`,
          SEP,
          `첨부 문서 1 = 이번 리포트(${cur.report.date}), 문서 2 = 이전 리포트(${prev.report.date})입니다. 표·차트의 숫자는 표에서 확인하세요.`,
        ]
      : [
          SEP,
          `[이번 리포트 본문 — ${cur.report.date}]`,
          SEP,
          `"""`,
          cur.pdfText,
          `"""`,
          ``,
          SEP,
          `[이전 리포트 본문 — ${prev.report.date}]`,
          SEP,
          `"""`,
          prev.pdfText,
          `"""`,
        ]),
  ].join("\n");
}
