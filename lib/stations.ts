// Shop-floor station model.
//
// The CRM Production Scheduler routes work against ~21 fine-grained "work
// centers" (rip saw, planer, glue bench, …). On the production floor the shop
// runs as 10 departments / stations. This module defines those 10 stations,
// rolls the work centers up into them, and turns scheduler jobs/units into
// station-grouped "floor operations" the board renders.

import {
  OPERATORS,
  type Operator,
  type ManufacturingOrder,
} from "./scheduler/seed";
import { mapWorkCenter, type Unit } from "./scheduler/model";
import { type Material } from "./currentJobs";

export type OpMaterial = Material | "both" | null;

export type StationKind = "office" | "shop";

export interface Station {
  id: string;
  seq: number; // 1..10 — position in the standard production flow
  name: string;
  short: string;
  blurb: string; // what happens at this station (from the shop's station list)
  kind: StationKind; // office = pre-production (not auto-scheduled); shop = floor
  workCenters: string[]; // engine work-center ids rolled up into this station
  color: string;
}

// The shop's 10 production-floor stations, in flow order. `workCenters` are the
// engine work-center ids (see lib/scheduler/seed.ts) that belong to each.
export const STATIONS: Station[] = [
  {
    id: "engineering", seq: 1, name: "Engineering", short: "ENG", kind: "office",
    blurb: "Shop drawings, production drawings, glass orders, hardware orders",
    workCenters: [], color: "#8a93a6",
  },
  {
    id: "programming", seq: 2, name: "Programming", short: "PROG", kind: "office",
    blurb: "Output CNC files to the machines (Accord, Record, Crafter)",
    workCenters: [], color: "#7d86c2",
  },
  {
    id: "mill", seq: 3, name: "Mill / Blanking", short: "MILL", kind: "shop",
    blurb: "Blank material for the machines — rip, rough-mill, joint, plane, cut-to-length",
    workCenters: ["rip_saw", "rough_mill", "planer", "jointer", "upcut_saw"], color: "#e8d4b0",
  },
  {
    id: "cnc", seq: 4, name: "CNC", short: "CNC", kind: "shop",
    blurb: "Accord 25, Record, Crafter — profiling, joinery, cope & stick, laser plate",
    workCenters: ["cnc_accord", "laser"], color: "#9fd6ce",
  },
  {
    id: "gluing", seq: 5, name: "Gluing", short: "GLUE", kind: "shop",
    blurb: "Glue-ups, clamp & cure of stiles, rails and panel cores",
    workCenters: ["glue_bench", "clamp_rack"], color: "#f3c08a",
  },
  {
    id: "assembly", seq: 6, name: "Assembly", short: "ASSY", kind: "shop",
    blurb: "Sash & frame assembly, sanding, welded steel sub-frames and hardware prep",
    workCenters: ["assembly_table", "frame_station", "weld_booth", "sander_dmc"], color: "#aac0e6",
  },
  {
    id: "grid", seq: 7, name: "Grid Center", short: "GRID", kind: "shop",
    blurb: "SDL / muntin grids — build and fit divided-lite grids",
    workCenters: ["muntin_cell"], color: "#d8c3a6",
  },
  {
    id: "paint", seq: 8, name: "Paint", short: "PAINT", kind: "shop",
    blurb: "Prime, finish-coat and cure",
    workCenters: ["paint_shop"], color: "#9fcf9f",
  },
  {
    id: "glass", seq: 9, name: "Glass", short: "GLASS", kind: "shop",
    blurb: "Glaze sash — tape, Dow 995 sealant, set glass + SDLs, bead and QC",
    workCenters: ["glazing_station"], color: "#bcd6b0",
  },
  {
    id: "final", seq: 10, name: "Final Assembly", short: "FINAL", kind: "shop",
    blurb: "Hang, install hardware, deburr, QA, wrap & ship",
    workCenters: ["final_assembly", "packing", "qa", "manual_bench", "manual_station"], color: "#a9c4d4",
  },
];

const byId: Record<string, Station> = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

// Production zone. The two material lines stay SEPARATE through fabrication
// (Engineering → Grid Center) and CONVERGE from Paint on — Paint, Glass and
// Final Assembly (incl. hardware) are shared by one crew across wood + metal.
export type StationZone = "fab" | "finish";
export function stationZone(st: Station): StationZone {
  return st.seq >= 8 ? "finish" : "fab";
}
export const FAB_STATIONS = STATIONS.filter((s) => stationZone(s) === "fab");
export const FINISH_STATIONS = STATIONS.filter((s) => stationZone(s) === "finish");

// Classify a unit/MO as wood, metal, both, or unknown from its material field
// and any descriptive text. Used to split the fabrication swim lanes. Decided
// once per unit/MO so every one of its operations lands in the same lane.
const WOOD_RE = /wood|oak|maple|mahog|walnut|cherry|pine|fir|lumber|stave|stile|plank|panel|sash/i;
const METAL_RE = /steel|stainless|metal|alum|bronze|weld|plate/i;
export function classifyMaterial(...texts: (string | undefined)[]): OpMaterial {
  const s = texts.filter(Boolean).join(" ");
  if (!s) return null;
  if (/both/i.test(s)) return "both";
  const wood = WOOD_RE.test(s);
  const metal = METAL_RE.test(s);
  if (wood && metal) return "both";
  if (wood) return "wood";
  if (metal) return "metal";
  return null;
}

// work-center id -> station id
const WC_TO_STATION: Record<string, string> = {};
for (const st of STATIONS) for (const wc of st.workCenters) WC_TO_STATION[wc] = st.id;

export function getStation(id: string): Station | undefined {
  return byId[id];
}

// Resolve a canonical engine work-center id to its floor station (the sample
// Door A build stores canonical ids directly on its operations).
export function stationForWorkCenterId(id: string): Station {
  return byId[WC_TO_STATION[id]] ?? byId.final;
}

// Resolve a free-text task work-center name (as entered on a unit in the CRM
// Production Scheduler) to a floor station. Programming is detected first (it
// otherwise reads as generic "office"); other office/pre-production work folds
// into Engineering; shop work routes through the work-center mapper.
export function stationForTaskWC(name: string): Station {
  const lower = (name || "").toLowerCase();
  if (/program|post\b|postprocess|output|toolpath|g.?code|nc file|machine file/.test(lower)) {
    return byId.programming;
  }
  const m = mapWorkCenter(name);
  if (m.office) return byId.engineering;
  return stationForWorkCenterId(m.id);
}

/* ---------------------------------------------------------- floor ops */

// One operation placed on the floor board. `id` matches the scheduling engine's
// operation id (op.id for the sample; `${unitId}__t${taskIndex}` for real
// units), so an auto-schedule result can be joined back on it.
export interface FloorOp {
  id: string;
  name: string;
  stationId: string;
  minutes: number;
  moId: string; // unit mark / MO id
  product: string;
  priority: number;
  due: string;
  jobId?: string;
  jobName?: string;
  office: boolean; // engineering/programming — tracked but not auto-scheduled
  material: OpMaterial; // which fabrication swim lane it belongs to
}

// Door A sample → floor ops.
export function floorOpsFromMOs(mos: ManufacturingOrder[]): FloorOp[] {
  const out: FloorOp[] = [];
  for (const mo of mos) {
    const material = classifyMaterial(mo.product, mo.code, mo.operations.map((o) => o.name).join(" "));
    for (const o of mo.operations) {
      const st = stationForWorkCenterId(o.workCenter);
      out.push({
        id: o.id, name: o.name, stationId: st.id, minutes: o.minutes,
        moId: mo.id, product: mo.product, priority: mo.priority, due: mo.due,
        office: st.kind === "office", material,
      });
    }
  }
  return out;
}

// Real scheduler units → floor ops (keeps office steps visible, unlike the
// engine, which drops them from the schedulable set).
export function floorOpsFromUnits(units: Unit[], jobName?: (jobId: string) => string | undefined): FloorOp[] {
  const out: FloorOp[] = [];
  for (const u of units) {
    const qty = u.qty && u.qty > 0 ? u.qty : 1;
    const label = u.mark?.trim() || u.typeCode?.trim() || "Unit";
    const product = u.description || u.typeName || u.typeCode || label;
    const priority = u.priority && u.priority > 0 ? u.priority : 3;
    const material = classifyMaterial(u.material, u.typeName, u.description, u.category, u.typeCode);
    (u.tasks || []).forEach((t, ti) => {
      const st = stationForTaskWC(t.workCenter);
      out.push({
        id: `${u.id}__t${ti}`,
        name: t.name || t.workCenter || `Step ${ti + 1}`,
        stationId: st.id,
        minutes: Math.max(1, Math.round((t.minutes || 0) * qty)),
        moId: label, product, priority, due: u.due || "",
        jobId: u.jobId, jobName: jobName?.(u.jobId), office: st.kind === "office", material,
      });
    });
  }
  return out;
}

/* ------------------------------------------------- employee capability */

// The floor stations an operator can work, derived from their work-center
// skills. Engineering/Programming are office stations with no work centers, so
// they are staffed from the office — not from this shop-operator roster.
export function stationsForOperator(op: Operator): string[] {
  return STATIONS.filter((s) => s.workCenters.some((wc) => op.skills.includes(wc))).map((s) => s.id);
}

// How many active operators are cross-trained on a station (its bus factor).
export function staffingForStation(stationId: string, operators: Operator[] = OPERATORS): Operator[] {
  const st = byId[stationId];
  if (!st) return [];
  return operators.filter((o) => st.workCenters.some((wc) => o.skills.includes(wc)));
}
