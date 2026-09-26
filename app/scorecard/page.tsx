import type { Metadata } from "next";
import ScorecardView from "@/components/Scorecard";

export const metadata: Metadata = { title: "애널리스트 적중률 성적표 · KIRS 분석기" };

export default function ScorecardPage() {
  return (
    <main className="flex-1">
      <ScorecardView />
    </main>
  );
}
