// 공용 작은 UI 조각들 (토스 계열 스타일)
import type { Sector } from "@/lib/sector";
import type { BriefSummary } from "@/lib/types";

// 스탠스 계열별 아바타 색
function stanceTone(stance?: string) {
  if (!stance) return "bg-g100 text-g600";
  if (stance.startsWith("구조확신")) return "bg-tb-50 text-tb";
  if (stance.startsWith("조건부")) return "bg-amber-50 text-amber-700";
  if (stance.startsWith("발굴소개")) return "bg-emerald-50 text-emerald-700";
  if (stance.startsWith("턴어라운드")) return "bg-to-50 text-orange-700";
  if (stance.startsWith("이벤트")) return "bg-violet-50 text-violet-700";
  return "bg-g100 text-g600";
}

const SIZE = {
  xs: "h-6 w-6 text-[11px]",
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-[14px]",
  lg: "h-12 w-12 text-[17px]",
};

export function Avatar({ name, stance, size = "md" }: { name: string; stance?: string; size?: keyof typeof SIZE }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold ${SIZE[size]} ${stanceTone(stance)}`}>
      {name.slice(0, 1)}
    </span>
  );
}

// 섹터 색 클래스에서 테두리만 뺀다 (lib/sector의 color는 배지용 bg·text·border 묶음)
const noBorder = (c: string) => c.replace(/border-\S+/g, "");

// 종목 "로고" 자리: 섹터 색 원 안에 종목명 첫 글자
export function CompanyMark({ name, sector, size = "md" }: { name: string; sector: Pick<Sector, "color">; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-12 w-12 text-[18px]" : "h-10 w-10 text-[15px]";
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold ${dim} ${noBorder(sector.color)}`}>
      {name.replace(/^\(주\)/, "").slice(0, 1)}
    </span>
  );
}

export const VERDICT_TONE: Record<BriefSummary["verdict"], string> = {
  필독: "bg-tr-50 text-tr",
  참고: "bg-g100 text-g700",
  패스: "bg-g100 text-g500",
};

export function VerdictBadge({ verdict, size = "sm" }: { verdict: BriefSummary["verdict"]; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md font-bold ${VERDICT_TONE[verdict]} ${
        size === "md" ? "px-2 py-1 text-[13px]" : "px-1.5 py-0.5 text-[12px]"
      }`}
    >
      {verdict}
    </span>
  );
}

// 긍정 가능성 숫자 색: 높을수록 진하게 (빨강 = 좋음, 국내 시세 관례와 같은 방향)
export const oddsTone = (p: number) => (p >= 60 ? "text-tr" : p >= 40 ? "text-g800" : "text-g500");
export const oddsBar = (p: number) => (p >= 60 ? "bg-tr" : p >= 40 ? "bg-g600" : "bg-g300");

// 수익률: 빨강 상승 / 파랑 하락
export const pct = (v?: number | null, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(d)}%`);
export const retTone = (v?: number | null) => (v == null ? "text-g400" : v > 0 ? "text-tr" : v < 0 ? "text-tb" : "text-g600");

// 흰 섹션 블록: 모바일은 화면 가득, 데스크톱은 둥근 카드
export function Block({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`bg-white px-5 py-6 sm:rounded-3xl sm:px-7 ${className}`}>{children}</section>;
}

export function BlockTitle({ children, sub, right }: { children: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[20px] font-bold tracking-tight text-g900">{children}</h2>
        {sub && <p className="mt-1 text-[14px] text-g500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function SectorPill({ sector }: { sector: Pick<Sector, "label" | "color"> }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-px text-[12px] font-medium ${noBorder(sector.color)}`}>
      {sector.label}
    </span>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-[17px] font-bold tracking-tight text-g900">{children}</h3>
      {right}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-g200 border-t-tb ${className}`} />;
}
