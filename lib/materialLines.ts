// Build the home-page metal/wood production lines from the REAL jobs in the
// database: a job lands on the metal line if any of its units is metal (or both)
// and on the wood line if any unit is wood (or both); jobs whose units carry no
// material yet show on both lines flagged "set material". When there are no
// jobs with units at all, fall back to the seeded list in currentJobs.ts.

import { classifyMaterial } from "./stations";
import { CURRENT_JOBS, isSharedJob } from "./currentJobs";

export interface LineJob { name: string; shared: boolean; unknown: boolean }
export interface MaterialLines { metal: LineJob[]; wood: LineJob[]; fromSeed: boolean }

interface JobRec { id: string; name: string; jobNumber?: string }
interface UnitRec { id: string; jobId: string; material?: string; typeName?: string; description?: string; category?: string; typeCode?: string }

export function buildMaterialLines(jobs: JobRec[], units: UnitRec[]): MaterialLines {
  const byJob: Record<string, UnitRec[]> = {};
  for (const u of units) (byJob[u.jobId] ||= []).push(u);

  const metal: LineJob[] = [];
  const wood: LineJob[] = [];
  const sorted = [...jobs].sort(
    (a, b) => (a.jobNumber || "").localeCompare(b.jobNumber || "") || a.name.localeCompare(b.name)
  );

  for (const j of sorted) {
    const us = byJob[j.id] || [];
    if (!us.length) continue; // a job with no units can't be placed on a line
    let hasMetal = false, hasWood = false, hasAny = false;
    for (const u of us) {
      const m = classifyMaterial(u.material, u.typeName, u.description, u.category, u.typeCode);
      if (m === "both") { hasMetal = true; hasWood = true; hasAny = true; }
      else if (m === "metal") { hasMetal = true; hasAny = true; }
      else if (m === "wood") { hasWood = true; hasAny = true; }
    }
    const name = j.name;
    if (!hasAny) {
      metal.push({ name, shared: false, unknown: true });
      wood.push({ name, shared: false, unknown: true });
      continue;
    }
    const shared = hasMetal && hasWood;
    if (hasMetal) metal.push({ name, shared, unknown: false });
    if (hasWood) wood.push({ name, shared, unknown: false });
  }

  if (metal.length === 0 && wood.length === 0) {
    return {
      metal: CURRENT_JOBS.metal.map((n) => ({ name: n, shared: isSharedJob(n), unknown: false })),
      wood: CURRENT_JOBS.wood.map((n) => ({ name: n, shared: isSharedJob(n), unknown: false })),
      fromSeed: true,
    };
  }
  return { metal, wood, fromSeed: false };
}
