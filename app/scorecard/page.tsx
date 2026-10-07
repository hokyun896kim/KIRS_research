import type { Metadata } from "next";
import ScorecardView from "@/components/Scorecard";

export const metadata: Metadata = { title: "애널 성적표" };

export default function ScorecardPage() {
  return (
    <main className="flex-1">
      <ScorecardView />
    </main>
  );
}
