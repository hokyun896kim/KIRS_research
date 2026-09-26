# KIRS 리포트 · 애널리스트별 분석기

한국IR협의회 기업리서치센터 [리서치 보고서](https://www.kirs.or.kr/research/research22_1.html)를
**작성 애널리스트의 렌즈**로 해석하는 "완성 프롬프트"를 자동 생성하는 웹앱입니다.
LLM API를 호출하지 않고, 지침 + 애널 프로파일 + PDF 본문을 합친 프롬프트를 만들어
ChatGPT / Claude 등에 **복사·붙여넣기**해서 쓰는 방식입니다. (API 키·비용 0)

## 동작 흐름

1. KIRS 목록을 서버에서 긁어 `종목 / 제목 / 애널 / 발간일 / PDF` 로 표시
2. 보고서 클릭 → PDF 본문을 서버에서 추출하고 `Analyst / RA` 식별
3. 식별된 작성자를 14인 프로파일 표에 매칭(주렌즈/보조렌즈)
4. `지침 전문 + 매칭 프로파일 + 리포트 본문`을 합친 프롬프트 생성
5. **풀모드(모듈 1~5)** / **매매모드(+모듈 6)** 토글 → 복사 → ChatGPT·Claude에 붙여넣기

## 구조

```
app/
  page.tsx               메인(목록)
  api/reports/route.ts   KIRS 목록 스크랩 (SSL 우회)
  api/extract/route.ts   PDF 추출 + 프로파일 매칭 + 프롬프트 조립
components/
  ReportList.tsx         목록 + 검색 + 애널 칩 + 페이지네이션
  ReportDetail.tsx       상세 드로어 + 프롬프트 빌더
lib/
  guideline.md           분석 지침 전문 (PART A/B) — 프롬프트의 핵심
  profiles.ts            14인 애널리스트 프로파일 + 매칭 로직
  kirs.ts                KIRS 목록 스크래핑 + PDF 본문 추출
  prompt.ts              완성 프롬프트 조립
  sector.ts              종목명·제목 키워드 기반 섹터 추정
```

## 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## AI 자동분석 (선택)

상세 화면의 **AI 자동분석 ✨** 탭은 `app/api/analyze/route.ts`에서 Anthropic API(`claude-sonnet-4-6`)를
호출해 결과를 스트리밍합니다. Vercel 프로젝트 → Settings → Environment Variables 에
`ANTHROPIC_API_KEY`를 추가하면 켜집니다. (없어도 프롬프트 복사 기능은 그대로 동작)

## 배포

GitHub `main` 브랜치에 푸시하면 Vercel이 자동 배포합니다. (리전: `icn1`, `vercel.json`)
