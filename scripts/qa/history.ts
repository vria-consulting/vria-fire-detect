// Journal des runs de QA : chaque passage est archivé (JSONL local, hors git)
// pour que la rétrospective compare les runs entre eux — régressions, tests
// réparés, tests instables (flaky), tests aveugles.

import { mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./util";

const DIR = join(process.cwd(), "scripts", "qa", "history");
const FILE = join(DIR, "runs.jsonl");

export type RunRecord = {
  at: string;
  target: string;
  results: CheckResult[];
};

// Les vérifications à nom dynamique (un foyer échantillonné change à chaque
// run) sont agrégées sous un nom de famille stable pour être comparables.
export function stableName(name: string): string {
  if (/^Foyer /.test(name)) return "Foyer échantillonné vs FIRMS brut";
  return name;
}

export function appendRun(target: string, results: CheckResult[]): void {
  mkdirSync(DIR, { recursive: true });
  const rec: RunRecord = { at: new Date().toISOString(), target, results };
  appendFileSync(FILE, JSON.stringify(rec) + "\n");
}

export function loadRuns(target: string, n: number): RunRecord[] {
  if (!existsSync(FILE)) return [];
  return readFileSync(FILE, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RunRecord)
    .filter((r) => r.target === target)
    .slice(-n);
}
