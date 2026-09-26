// 종목명 + 제목 키워드로 섹터를 추정한다. (휴리스틱 — 정확한 섹터는 PDF 1면의 분류 태그 참고)
export type Sector = {
  key: string;
  label: string;
  color: string; // tailwind 색 토큰 (배경/텍스트/테두리)
  keywords: string[];
};

// 위에서부터 우선 매칭 (구체적 → 일반)
export const SECTORS: Sector[] = [
  {
    key: "battery", label: "2차전지", color: "bg-lime-50 text-lime-700 border-lime-200",
    keywords: ["2차전지", "이차전지", "배터리", "양극재", "음극재", "전해액", "분리막", "동박", "니켈도금", "전구체", "리튬", "ESS"],
  },
  {
    key: "semi", label: "반도체", color: "bg-sky-50 text-sky-700 border-sky-200",
    keywords: ["반도체", "웨이퍼", "쿼츠", "HBM", "파운드리", "후공정", "패키징", "노광", "식각", "CMP", "소부장", "세라믹", "전공정", "디램", "낸드", "테스트", "프로브"],
  },
  {
    key: "bio", label: "바이오·제약", color: "bg-rose-50 text-rose-700 border-rose-200",
    keywords: ["바이오", "제약", "신약", "임상", "항체", "진단", "유전체", "액체생검", "CDMO", "CMO", "백신", "RNA", "세포", "치료제", "의료기기", "헬스", "원료의약"],
  },
  {
    key: "enter", label: "엔터·미디어", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    keywords: ["엔터", "아티스트", "콘텐츠", "웹툰", "드라마", "음반", "공연", "MD", "IP 수익", "글로벌 IP", "팬덤", "미디어", "방송"],
  },
  {
    key: "it", label: "IT·플랫폼·SW", color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    keywords: ["플랫폼", "소프트웨어", "SaaS", "클라우드", "보안", "결제", "핀테크", "게임", "커머스", "솔루션", "데이터센터", "AI 모델", "SW"],
  },
  {
    key: "robot", label: "로봇·기계·방산", color: "bg-amber-50 text-amber-700 border-amber-200",
    keywords: ["로봇", "협동로봇", "기계", "공작기계", "자동화", "방산", "무기", "드론", "항공", "우주"],
  },
  {
    key: "ship", label: "조선·기자재·인프라", color: "bg-teal-50 text-teal-700 border-teal-200",
    keywords: ["조선", "기자재", "플랜트", "건설", "풍력", "해상풍력", "원전", "인프라", "MRO", "수주", "타워", "전선", "변압기", "에너지"],
  },
  {
    key: "auto", label: "자동차·전장", color: "bg-slate-100 text-slate-700 border-slate-200",
    keywords: ["전장", "자동차", "모빌리티", "타이어", "차량", "EV 부품", "ADAS"],
  },
  {
    key: "elec", label: "전자부품·통신", color: "bg-cyan-50 text-cyan-700 border-cyan-200",
    keywords: ["무선충전", "MLCC", "카메라", "디스플레이", "OLED", "통신", "모듈", "FPCB", "기판", "안테나", "커넥터"],
  },
  {
    key: "steel", label: "소재·철강·화학", color: "bg-stone-100 text-stone-700 border-stone-200",
    keywords: ["철강", "화학", "소재", "비철", "정밀화학", "필름", "첨가제", "도료"],
  },
  {
    key: "consumer", label: "소비재·유통", color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    keywords: ["화장품", "음식료", "유통", "의류", "패션", "식품", "뷰티", "ODM", "OEM", "리테일", "소비재", "생활용품", "주류", "건기식"],
  },
];

export const ETC_SECTOR: Sector = { key: "etc", label: "기타", color: "bg-gray-100 text-gray-600 border-gray-200", keywords: [] };

export const ALL_SECTORS: Sector[] = [...SECTORS, ETC_SECTOR];

export function classifySector(name: string, title: string): Sector {
  const hay = `${name} ${title}`;
  for (const s of SECTORS) {
    if (s.keywords.some((k) => hay.includes(k))) return s;
  }
  return ETC_SECTOR;
}
