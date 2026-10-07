// 분석·브리핑 모델. 같은 리포트로 비교했을 때 Sonnet 5.5(사고 끔)가 4.6보다 근거 인용·성과 보정이 정확하고
// 풀모드가 211초 → 74초로 빨라졌다. 기본 사고를 켜 두면 첫 글자까지 2~3분이 걸려 끈다.
export const ANALYSIS_MODEL = "claude-sonnet-5-5";

// Sonnet 5.x는 "disabled" 대신 "between_tools"로 사고를 끈다 (SDK 타입에 아직 없어 캐스팅)
export const THINKING_OFF = { type: "between_tools" } as unknown as { type: "disabled" };
