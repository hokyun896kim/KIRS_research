import "server-only";
import fs from "node:fs";
import path from "node:path";

let cache: string | null = null;

export function getGuideline(): string {
  if (cache == null) {
    cache = fs.readFileSync(path.join(process.cwd(), "lib", "guideline.md"), "utf-8");
  }
  return cache;
}
