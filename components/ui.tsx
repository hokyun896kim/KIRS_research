// 공용 작은 UI 조각들 (아바타·섹터 배지·섹션 제목)
import type { Sector } from "@/lib/sector";

// 스탠스 계열별 아바타 색 (AnalystCard의 stanceDot과 같은 계열)
function stanceTone(stance?: string) {
  if (!stance) return "bg-slate-200 text-slate-600";
  if (stance.startsWith("구조확신")) return "bg-blue-100 text-blue-700";
  if (stance.startsWith("조건부")) return "bg-amber-100 text-amber-800";
  if (stance.startsWith("발굴소개")) return "bg-emerald-100 text-emerald-700";
  if (stance.startsWith("턴어라운드")) return "bg-orange-100 text-orange-700";
  if (stance.startsWith("이벤트")) return "bg-violet-100 text-violet-700";
  return "bg-slate-200 text-slate-600";
}

const SIZE = {
  xs: "h-6 w-6 text-[11px]",
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-[13px]",
  lg: "h-11 w-11 text-base",
};

export function Avatar({
  name,
  stance,
  size = "md",
}: {
  name: string;
  stance?: string;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold ${SIZE[size]} ${stanceTone(stance)}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function SectorPill({
  sector,
}: {
  sector: Pick<Sector, "label" | "color">;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[11px] font-medium ${sector.color}`}
    >
      {sector.label}
    </span>
  );
}

export function SectionTitle({
  icon,
  children,
  right,
}: {
  icon?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-slate-900">
        {icon && <span>{icon}</span>}
        {children}
      </h3>
      {right}
    </div>
  );
}
