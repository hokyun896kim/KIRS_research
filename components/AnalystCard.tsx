import type { Profile } from "@/lib/profiles";

export function stanceColor(stance?: string): string {
  if (!stance) return "bg-slate-100 text-slate-700 border-slate-200";
  if (stance.startsWith("구조확신")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (stance.startsWith("조건부")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (stance.startsWith("발굴소개")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (stance.startsWith("턴어라운드")) return "bg-orange-50 text-orange-700 border-orange-200";
  if (stance.startsWith("이벤트")) return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function stanceDot(stance?: string): string {
  if (!stance) return "bg-slate-300";
  if (stance.startsWith("구조확신")) return "bg-blue-500";
  if (stance.startsWith("조건부")) return "bg-amber-500";
  if (stance.startsWith("발굴소개")) return "bg-emerald-500";
  if (stance.startsWith("턴어라운드")) return "bg-orange-500";
  if (stance.startsWith("이벤트")) return "bg-violet-500";
  return "bg-slate-300";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-[13px] leading-snug text-slate-700">{children}</div>
    </div>
  );
}

export default function AnalystCard({ p, role }: { p: Profile; role?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${stanceColor(p.stance)}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        {role && <span className="text-[11px] font-semibold opacity-70">{role}</span>}
        <span className="text-base font-bold">{p.name}</span>
        <span className="text-sm opacity-80">{p.type}</span>
        {p.warn && (
          <span className="rounded bg-white/60 px-1.5 py-0.5 text-[11px] font-medium">⚠ 공동작성 영향 큼(관찰)</span>
        )}
      </div>
      <div className="mt-1 text-sm font-medium opacity-90">💬 “{p.oneQuestion}”</div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 rounded-lg bg-white/55 p-3 sm:grid-cols-2">
        <Field label="스탠스">{p.stance}</Field>
        <Field label="한 줄 지침">{p.guide}</Field>
        <Field label="강점">{p.strength}</Field>
        <Field label="주의·검증">{p.caution}</Field>
        <div className="sm:col-span-2">
          <Field label="문법·키워드">{p.keyword}</Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="강한 섹터">
            <div className="mt-1 flex flex-wrap gap-1">
              {p.sectors.map((s) => (
                <span key={s} className="rounded-full bg-white/70 px-2 py-0.5 text-[12px]">
                  {s}
                </span>
              ))}
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="주요 신호 (이렇게 쓰면 → 이렇게 읽어라)">
            <ul className="mt-0.5 space-y-1">
              {p.signals.map((s, i) => (
                <li key={i} className="flex gap-1.5 text-[12.5px] leading-snug">
                  <span className="opacity-50">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Field>
        </div>
      </div>
    </div>
  );
}
