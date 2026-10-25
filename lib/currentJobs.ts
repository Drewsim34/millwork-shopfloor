// Current production jobs, by material line, in running order.
//
// The shop runs two fabrication lines that stay SEPARATE through the early
// stations (Engineering → Grid Center) and then CONVERGE: from Paint on
// (Paint, Glass/Glazing, Hardware, Final Assembly) wood and metal are finished
// by the same crew. A job that appears in both lists has both wood and metal
// components that merge at the finishing zone.
//
// This is the live running order the floor works to. It's seeded here so the
// board reflects reality before every job is fully built out in the CRM
// Production Scheduler; edit the arrays to re-sequence a line.

export type Material = "metal" | "wood";

export const MATERIAL_META: Record<Material, { label: string; color: string; accent: string }> = {
  metal: { label: "Metal", color: "#5b6b7a", accent: "#eef2f6" },
  wood: { label: "Wood", color: "#9a6b3f", accent: "#f6efe7" },
};

// Running order per line (index 0 = next up / furthest along).
export const CURRENT_JOBS: Record<Material, string[]> = {
  metal: ["5555 Helena", "Goldblatt", "Showtruck", "Klapac", "Katz", "Bedons", "East Battery", "Dyke", "Rogers"],
  wood: ["Stronach", "Bedons", "Showtruck", "Dyke", "Rogers"],
};

const norm = (s: string) => s.trim().toLowerCase();

// Jobs that run in BOTH materials (merge at the finishing zone).
export const SHARED_JOBS: string[] = CURRENT_JOBS.metal.filter((m) =>
  CURRENT_JOBS.wood.some((w) => norm(w) === norm(m))
);

export function isSharedJob(name: string): boolean {
  return SHARED_JOBS.some((s) => norm(s) === norm(name));
}

// The materials a given job runs in.
export function materialsFor(name: string): Material[] {
  const out: Material[] = [];
  if (CURRENT_JOBS.metal.some((j) => norm(j) === norm(name))) out.push("metal");
  if (CURRENT_JOBS.wood.some((j) => norm(j) === norm(name))) out.push("wood");
  return out;
}

// Every job once, for the shared finishing funnel. Metal order first, then any
// wood-only jobs appended in their line order.
export function allJobsUnique(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...CURRENT_JOBS.metal, ...CURRENT_JOBS.wood]) {
    if (!seen.has(norm(name))) { seen.add(norm(name)); out.push(name); }
  }
  return out;
}
