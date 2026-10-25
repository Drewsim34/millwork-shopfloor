// Production-scheduler domain model. Mirrors millwork-crm/lib/scheduler/model.ts.
// Turns a job's units (each with its own BoM + task routing, as entered in the
// CRM Production Scheduler) into the engine's ManufacturingOrder[] input.

import {
  WORK_CENTERS,
  type WorkCenter,
  type ManufacturingOrder,
  type Operation,
} from "./seed";

/* --------------------------------------------------------------- records */

export interface BomLine {
  code?: string;
  name: string;
  qty?: number;
  makeBuy?: string; // "Make" | "Buy"
}

export interface TaskLine {
  step?: number;
  name: string;
  workCenter: string; // free-text (mapped to an engine work center at schedule time)
  minutes: number;
  skilled?: boolean;
}

export interface UnitType {
  id: string;
  code: string;
  name: string;
  category?: string;
  bom: BomLine[];
  tasks: TaskLine[];
}

export interface Job {
  id: string;
  jobNumber?: string;
  name: string;
  address?: string;
  customer?: string;
  dueDate?: string;
  notes?: string;
}

export interface Unit {
  id: string;
  jobId: string;
  mark?: string;
  typeCode?: string;
  typeName?: string;
  category?: string;
  location?: string;
  description?: string;
  material?: string;
  finish?: string;
  qty?: number;
  width?: number;
  height?: number;
  thickness?: number;
  jambDepth?: number;
  priority?: number;
  due?: string;
  bom: BomLine[];
  tasks: TaskLine[];
  sortOrder?: number;
}

export const UNIT_CATEGORIES = ["Window", "Door", "Other"] as const;

/* --------------------------------------------------------- JSON helpers */

export function parseLines<T>(s?: string | null): T[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------ work-center name → id */

// Free-text shop work-center names (from takeoffs / routings) mapped to the
// engine's canonical work-center ids. First matching rule wins, so order
// matters (e.g. "final assembly" before generic "assembly").
const WC_RULES: [RegExp, string][] = [
  [/cnc/, "cnc_accord"],
  [/laser/, "laser"],
  [/rip/, "rip_saw"],
  [/up\s*cut|cut to length/, "upcut_saw"],
  [/rough/, "rough_mill"],
  [/joint/, "jointer"],
  [/plan(e|er|ing)/, "planer"],
  [/mould|mold/, "planer"],
  [/mill/, "rough_mill"],
  [/glaz/, "glazing_station"],
  [/glue|gluing/, "glue_bench"],
  [/clamp/, "clamp_rack"],
  [/sand/, "sander_dmc"],
  [/muntin/, "muntin_cell"],
  [/weld/, "weld_booth"],
  [/frame/, "frame_station"],
  [/paint/, "paint_shop"],
  [/deburr|counter\s*sink/, "manual_station"],
  [/qa|quality|inspect/, "qa"],
  [/final/, "final_assembly"],
  [/pack|wrap|ship/, "packing"],
  [/cut/, "upcut_saw"],
  [/assembl|crafter/, "assembly_table"],
  [/bench/, "manual_bench"],
];

// Pre-production / office work that isn't a shop-floor production constraint.
const OFFICE_WC = /estimat|program|draft|design|sales|engineer|cad/i;

export function slugify(s: string): string {
  return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "wc";
}

export interface MappedWc {
  id: string;
  office: boolean;
  known: boolean;
}

export function mapWorkCenter(name: string): MappedWc {
  const lower = (name || "").toLowerCase().trim();
  if (!lower) return { id: "unassigned_wc", office: false, known: false };
  if (OFFICE_WC.test(lower)) return { id: slugify(name), office: true, known: false };
  for (const [re, id] of WC_RULES) if (re.test(lower)) return { id, office: false, known: true };
  return { id: slugify(name), office: false, known: false };
}

/* ----------------------------------------- units → engine schedule input */

export interface ScheduleInput {
  workCenters: WorkCenter[];
  mos: ManufacturingOrder[];
  skippedOffice: number; // count of office/pre-production tasks left out of the schedule
  unitsWithoutTasks: number; // units that contributed no schedulable operations
}

// Convert a job's units into the engine's MO list. Each unit becomes one MO;
// its tasks become sequential operations (task minutes × unit qty). Work-center
// names are mapped to engine ids, with unknown shop centers added as synthetic
// (capacity-1) centers so they still appear — and flag as unstaffed — rather
// than being silently dropped.
export function buildScheduleInput(units: Unit[]): ScheduleInput {
  const extra: Record<string, WorkCenter> = {};
  const mos: ManufacturingOrder[] = [];
  const seen = new Set<string>();
  let skippedOffice = 0;
  let unitsWithoutTasks = 0;

  units.forEach((u, ui) => {
    const qty = u.qty && u.qty > 0 ? u.qty : 1;
    const ops: Operation[] = [];
    (u.tasks || []).forEach((t, ti) => {
      const m = mapWorkCenter(t.workCenter);
      if (m.office) { skippedOffice++; return; }
      if (!WORK_CENTERS.some((w) => w.id === m.id) && !extra[m.id]) {
        extra[m.id] = { id: m.id, name: t.workCenter || m.id, capacity: 1, color: "#dcdcdc" };
      }
      ops.push({
        id: `${u.id}__t${ti}`,
        name: t.name || t.workCenter || `Step ${ti + 1}`,
        workCenter: m.id,
        minutes: Math.max(1, Math.round((t.minutes || 0) * qty)),
      });
    });

    if (!ops.length) { unitsWithoutTasks++; return; }

    // unique, readable MO id
    const base = u.mark?.trim() || u.typeCode?.trim() || `Unit ${ui + 1}`;
    let id = base;
    let n = 2;
    while (seen.has(id)) id = `${base} (${n++})`;
    seen.add(id);

    mos.push({
      id,
      code: u.typeCode || "",
      product: u.description || u.typeName || u.typeCode || base,
      units: qty,
      priority: u.priority && u.priority > 0 ? u.priority : 3,
      due: u.due || "",
      childMOs: [],
      operations: ops,
    });
  });

  const workCenters = [...WORK_CENTERS, ...Object.values(extra)];
  return { workCenters, mos, skippedOffice, unitsWithoutTasks };
}

/* ---------------------------------------------------- misc small helpers */

export function unitLabel(u: Unit): string {
  return [u.mark, u.description || u.typeName || u.typeCode].filter(Boolean).join(" — ") || "Unit";
}

export function totalMinutes(tasks: TaskLine[]): number {
  return (tasks || []).reduce((n, t) => n + (t.minutes || 0), 0);
}
