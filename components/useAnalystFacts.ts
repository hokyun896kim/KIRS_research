"use client";

import { useEffect, useState } from "react";
import type { AnalystFacts } from "@/lib/types";

// 한 번만 받아서 모든 애널 카드가 같이 쓴다
let cache: Promise<Record<string, AnalystFacts>> | null = null;

export function useAnalystFacts(): Record<string, AnalystFacts> {
  const [facts, setFacts] = useState<Record<string, AnalystFacts>>({});
  useEffect(() => {
    cache ??= fetch("/api/analysts")
      .then((r) => (r.ok ? r.json() : { facts: {} }))
      .then((j) => j.facts ?? {})
      .catch(() => {
        cache = null;
        return {};
      });
    let alive = true;
    cache.then((f) => alive && setFacts(f));
    return () => {
      alive = false;
    };
  }, []);
  return facts;
}
