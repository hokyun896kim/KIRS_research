// 한국IR협의회 리서치 보고서 — 14인 애널리스트 프로파일
// 출처: 사용자 제공 지침 PART A(STEP 2 표) + PART B(B-1, B-2, B-4, B-6)

export type Profile = {
  name: string;
  no: number;
  type: string; // 유형
  stance: string; // 스탠스
  ratio: string; // 지형/트리거
  keyword: string; // 문법·키워드
  strength: string; // 강점
  caution: string; // 주의/검증
  oneQuestion: string; // 원퀘스천
  guide: string; // B-6 한 줄 지침
  bestStock: string; // B-1 최적 종목
  warn: boolean; // ⚠ 관찰프로파일(공동작성 영향 큼)
  sectors: string[]; // B-2 라우팅 기준 강한 섹터
  signals: string[]; // B-4 신호 (이 애널이 ~하면 → 의미 / 대응)
};

export const PROFILES: Profile[] = [
  {
    name: "박성순", no: 1, type: "발굴소개형", stance: "발굴소개형 (지형55/트리거45)", ratio: "55/45",
    keyword: "기업선별→성장포인트·다변화→숫자점프. 고부가제품, 고객 다변화, 원년",
    strength: "산업-성장포인트 정리", caution: "옵션 과대 가능. 신규고객 퀄·매출시점 확인",
    oneQuestion: "이거 본업이야, 옵션이야?", guide: "좋아질 이유 찾기용. 숫자 시점은 따로.",
    bestStock: "성장초기 중소형", warn: false,
    sectors: ["성장 초기·IPO", "바이오·제약", "숨은 강소기업"],
    signals: ["리스크를 길게 쓰면 → 불안요소 있음 → 딜브레이커 확인"],
  },
  {
    name: "김경민", no: 2, type: "산업해설형", stance: "구조확신형 (지형60/발굴40)", ratio: "60/40",
    keyword: "산업구조→글로벌 사례→포지셔닝→밸류. 수혜 구조, 파트너십",
    strength: "수혜 이유 설득", caution: "산업논리→실적 시차 확인",
    oneQuestion: "숫자는 언제 찍히지?", guide: "산업 이해 강함. 타이밍은 따로.",
    bestStock: "글로벌 밸류체인 수혜", warn: false,
    sectors: ["글로벌 밸류체인"],
    signals: ["숫자에 집중하면 → 실적가시성이 포인트 → 숫자 확인"],
  },
  {
    name: "김선호", no: 3, type: "구조해설형", stance: "구조확신형 (지형75/트리거25)", ratio: "75/25",
    keyword: "공정 정의→기술 구조→진입장벽→숫자→밸류. 수확의 시간, 구조 재편",
    strength: "병목·해자·수익구조 설명", caution: "해자의 숫자 반영 시점 확인",
    oneQuestion: "이 해자, 진짜 안 뚫리나?", guide: "왜 안 뚫리나 보는 자료.",
    bestStock: "기술·공정·소재", warn: false,
    sectors: ["반도체·장비·소재", "글로벌 밸류체인"],
    signals: ["밸류를 강조하면 → 진짜 싸다는 신호 가능 → PER/PBR 확인"],
  },
  {
    name: "김승준", no: 4, type: "이벤트전환형", stance: "이벤트대기형 (트리거55/지형45)", ratio: "45/55",
    keyword: "핵심 자산→차기 이벤트→검증→기업가치. 재검증, 변곡점, 가시화",
    strength: "임상·규제·기술이전 번역", caution: "확률·조건·시차·희석 확인",
    oneQuestion: "이벤트 성공 확률이 몇 점이지?", guide: "이벤트 의미는 좋지만 확률은 별도.",
    bestStock: "바이오·제약 이벤트", warn: false,
    sectors: ["바이오·제약"],
    signals: ["이벤트 없이 펀더멘털만 쓰면 → 단기 모멘텀 약함 → 워치리스트"],
  },
  {
    name: "이나연", no: 5, type: "균형형", stance: "조건부기대형 (지형60/트리거40)", ratio: "60/40",
    keyword: "산업 변화→포지션→믹스 개선→실적 체력→밸류. 질적 전환, 과도기",
    strength: "숫자+구조 동시 점검", caution: "체질개선→주가모멘텀 시점 확인",
    oneQuestion: "체질 개선이 숫자로 보이나?", guide: "속으로 좋아지는 기업 찾기용.",
    bestStock: "마진개선 기업", warn: false,
    sectors: ["소비재·유통 믹스", "IT/플랫폼 전환", "본업 마진 개선"],
    signals: ["한쪽으로 치우치면 → 시그널 강함 → 해당 방향 집중"],
  },
  {
    name: "이원재", no: 6, type: "가치재평가형", stance: "구조확신형 (지형70/트리거30)", ratio: "70/30",
    keyword: "산업 구조→시장지위/Peer→자산가치 괴리→재평가. 독보적, 리레이팅",
    strength: "시장오해·밸류괴리 설명", caution: "촉매 없으면 만년저평가",
    oneQuestion: "왜 좋은데 아직 싸지?", guide: "왜 아직 싸게 보이나 먼저 읽기.",
    bestStock: "산업재·소재 저평가", warn: false,
    sectors: ["산업재·소재 밸류", "반도체·장비·소재", "저평가 OEM/ODM", "수주·인프라"],
    signals: ["리스크를 길게 쓰면 → 확신 낮음 → 리스크 점검"],
  },
  {
    name: "김태현", no: 7, type: "턴어라운드형", stance: "턴어라운드기대형 (반등60/지형40)", ratio: "40/60",
    keyword: "현재 부진→반등 요인→마진 개선→밸류 하단. 턴어라운드, 역사적 하단",
    strength: "부진/반등 이유 정리", caution: "장기옵션/단기반등 분리",
    oneQuestion: "내년 실적이 확실히 나아지나?", guide: "반등 가능성 점검표.",
    bestStock: "반등 가시성 기업", warn: false,
    sectors: ["턴어라운드", "산업재·소재 밸류"],
    signals: ["장기 성장을 길게 쓰면 → 구조 변화 가능 → 장기 관점 재검토"],
  },
  {
    name: "박선영", no: 8, type: "구조적 성장·정상화형", stance: "조건부기대형 (지형55/트리거45)", ratio: "55/45",
    keyword: "안정 본업→성장 엔진→정상화→레버리지. 캐시카우, 글로벌 확장",
    strength: "바닥+성장옵션 해석", caution: "해외·인허가·신사업 시차",
    oneQuestion: "이 회사 바닥이 뭐지?", guide: "바닥 본업부터 먼저.",
    bestStock: "캐시카우+성장동력", warn: false,
    sectors: ["캐시카우+신사업", "소비재·유통 믹스", "신제품 레버리지"],
    signals: ["본업에 의문을 달면 → 캐시카우 흔들림 → 본업 실적 점검"],
  },
  {
    name: "채윤석", no: 9, type: "사업모델전환형", stance: "구조확신형 (지형55/트리거45)", ratio: "55/45",
    keyword: "기존 사업→플랫폼/모듈/채널→다변화→재평가. 플랫폼, 전환, 레버리지",
    strength: "사업구조 변화 포착", caution: "전환→수익성 시점 확인",
    oneQuestion: "이 회사는 무엇으로 바뀌나?", guide: "뭘로 바뀌고 있나 보는 자료.",
    bestStock: "사업구조 고도화", warn: false,
    sectors: ["IT/플랫폼 전환", "캐시카우+신사업", "양산 전환"],
    signals: ["밸류 하단을 강조하면 → 전환보다 바닥 논리 → 턴어라운드 관점"],
  },
  {
    name: "백종석", no: 10, type: "성장동력발굴·검증형", stance: "발굴소개형 (지형60/트리거40)", ratio: "60/40",
    keyword: "기업개요→산업 성장축→기술/고객→실적→옵션. 강소기업, 성장판, 원년",
    strength: "숨은 중소형을 성장축과 연결", caution: "옵션 매출시점·고객확대·선반영 확인",
    oneQuestion: "숨은 성장동력이 숫자로 언제 찍히지?", guide: "숨은 성장동력 찾기용. 옵션 숫자화는 별도.",
    bestStock: "숨은 강소기업", warn: false,
    sectors: ["숨은 강소기업", "성장 초기·IPO"],
    signals: [
      "급등 후 추가 상승을 강조하면 → 옵션 선반영 가능 → 가격·PER/PSR 확인",
      "신사업을 길게 쓰는데 매출 시점이 흐리면 → 옵션 과대 → 본업/옵션 분리",
    ],
  },
  {
    name: "조영환", no: 11, type: "실적레버리지·마진 개선형", stance: "턴어라운드기대형 (반등65/지형35)", ratio: "35/65",
    keyword: "시장지위→ASP/Q/비용효율→마진→실적. 수익성 개선, 사상 최대",
    strength: "이익 증가 원리 분해", caution: "구조개선/기저효과 분리",
    oneQuestion: "이익률 개선이 구조적인가?", guide: "돈을 더 버는 구조 확인. 마진 지속성이 핵심.",
    bestStock: "마진·ASP/Q 개선 기업", warn: false,
    sectors: ["본업 마진 개선", "턴어라운드"],
    signals: [
      "기저효과 기반 수익성 개선을 강조하면 → 구조 개선 아닐 수 있음 → 일회성 제거 후 재계산",
      "ASP/Q를 동시에 강조하면 → 실적레버리지 강함 → 판가·물량·가동률 확인",
    ],
  },
  {
    name: "서진경", no: 12, type: "할인해소·리레이팅형", stance: "구조확신형 (지형50/트리거50)", ratio: "50/50",
    keyword: "사업/고객 구조→할인요인→촉매→EPS→멀티플. 리레이팅, 할인해소",
    strength: "저평가 원인/변화 해석", caution: "신규계약·고객다변화·히트 반복성 확인",
    oneQuestion: "할인받던 이유가 사라지나?", guide: "할인 이유가 사라지는지 확인. 촉매 없으면 보류.",
    bestStock: "저평가 OEM/ODM", warn: false,
    sectors: ["저평가 OEM/ODM", "소비재 ODM·히트제품"],
    signals: [
      "리레이팅 촉매가 '가능성' 수준이면 → 만년 저평가 위험 → 신규 계약·고객사 확인",
      "할인요인을 길게 설명하면 → 싼 이유가 명확 → 해소 조건 점검",
    ],
  },
  {
    name: "정수현", no: 13, type: "신제품사이클·영업레버리지형", stance: "조건부기대형 (지형45/트리거55)", ratio: "45/55",
    keyword: "제품 변화→신제품/양산→채널→믹스→레버리지. 신제품, 양산전환",
    strength: "신제품·소모품·양산 수익화 포착", caution: "공동작성영향. 출시/매출인식 분리",
    oneQuestion: "반복 매출로 굳어지나?", guide: "신제품·양산 초입 확인. 반복매출 전 과신 금지.",
    bestStock: "신제품·양산전환", warn: true,
    sectors: ["신제품·소모품 레버리지", "양산 전환·토탈솔루션"],
    signals: [
      "신제품사이클을 강조하면 → 초기 모멘텀 → 출시→판매→반복매출 확인",
      "레버리지를 강조하는데 고정비가 불명확하면 → 기대 선반영 가능 → 고정비율·가동률 확인",
    ],
  },
  {
    name: "이희경", no: 14, type: "수주인프라 확장형", stance: "이벤트대기형 (트리거60/지형40)", ratio: "40/60",
    keyword: "독점/레퍼런스→수주/인수→역량확대→매출. 국내 유일, MRO, 수주",
    strength: "수주·인수·설비의 실적화 포착", caution: "공동작성영향. 수주잔고·매출인식·초기비용",
    oneQuestion: "언제 이익으로 인식되나?", guide: "수주·인수가 실적으로 찍히는 타이밍 확인.",
    bestStock: "수주·MRO·인프라", warn: true,
    sectors: ["수주·계약·국산화·인프라", "조선기자재·MRO"],
    signals: [
      "수주·인수를 강조하면 → 이벤트 기반 가시화 → 수주잔고·매출인식 확인",
      "최대 실적과 초기비용을 동시에 언급하면 → 이익률 시차 가능 → 안정화 기간 확인",
    ],
  },
];

const BY_NAME = new Map(PROFILES.map((p) => [p.name, p]));

// "Analyst 김선호", "연구위원 이희경" 처럼 접두어·공백이 섞여도 매칭
export function matchProfile(name?: string | null): Profile | undefined {
  if (!name) return undefined;
  const n = name.replace(/\s+/g, "").replace(/^(Analyst|RA|연구원|연구위원)/i, "");
  return BY_NAME.get(n) ?? PROFILES.find((p) => n.includes(p.name));
}

// 반론 렌즈 기본값: 각 애널의 핵심 논리를 정면으로 묻는 상대를 짝지어 둔다.
// (예: 이벤트형 김승준 "성공 확률?" ↔ 박선영 "바닥 본업이 뭐지?")
export const COUNTER_OF: Record<string, string> = {
  박성순: "김경민", // 좋아질 이유 ↔ 숫자는 언제 찍히나
  김경민: "조영환", // 수혜 서사 ↔ 이익률이 구조적인가
  김선호: "김태현", // 해자 ↔ 내년 실적이 확실한가
  김승준: "박선영", // 이벤트 ↔ 바닥 본업
  이나연: "서진경", // 속으로 좋아짐 ↔ 촉매가 있나
  이원재: "채윤석", // 싸다 ↔ 무엇으로 바뀌나 (가치함정)
  김태현: "김선호", // 반등 ↔ 구조적 해자인가
  박선영: "백종석", // 바닥 본업 ↔ 성장동력이 숫자로 언제
  채윤석: "조영환", // 모델 전환 ↔ 돈을 더 버는가
  백종석: "박선영", // 숨은 성장동력 ↔ 바닥 본업
  조영환: "김선호", // 마진 개선 ↔ 해자 없이 지속되나
  서진경: "김승준", // 할인 해소 ↔ 촉매 확률
  정수현: "이나연", // 신제품 사이클 ↔ 체질 개선이 숫자로 보이나
  이희경: "조영환", // 수주 가시화 ↔ 이익률 (초기비용)
};

// 짝이 작성자·RA와 겹치면: 지형(구조) 비중 차이가 크고 스탠스 계열이 다른 애널로 대체.
const terrain = (p: Profile) => Number(p.ratio.split("/")[0]) || 50;
const stanceFamily = (p: Profile) => p.stance.split(" ")[0];

export function counterProfile(author?: Profile | null, exclude: string[] = []): Profile {
  const skip = new Set([author?.name, ...exclude]);
  const paired = author && BY_NAME.get(COUNTER_OF[author.name]);
  if (paired && !skip.has(paired.name)) return paired;
  const pool = PROFILES.filter((p) => !skip.has(p.name));
  if (!author) return BY_NAME.get("김선호") && !skip.has("김선호") ? BY_NAME.get("김선호")! : pool[0];
  const score = (p: Profile) =>
    Math.abs(terrain(p) - terrain(author)) + (stanceFamily(p) !== stanceFamily(author) ? 10 : 0);
  return pool.reduce((a, b) => (score(b) > score(a) ? b : a));
}
