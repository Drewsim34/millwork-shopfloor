// Dependency-aware list scheduler. Mirrors millwork-crm/lib/scheduler/engine.ts.
//
// Respects: BoM dependencies (op order within an MO + sub-assembly completion),
// work-center capacity, operator skills & availability, and MO priority/due.
// Produces a concrete schedule + per-operator / per-station timelines + a
// plain-language rationale.

import type { Operator, WorkCenter, ManufacturingOrder } from "./seed";

const SHIFT_START = 8 * 60; // 8:00 in minutes
const SHIFT_MINUTES = 8 * 60; // 8h working day (480)
const DAY0 = "2026-06-15"; // Monday anchor

export interface ScheduledOp {
  id: string;
  name: string;
  wc: string;
  minutes: number;
  mo: string;
  moProduct: string;
  priority: number;
  due: string;
  deps: string[];
  start: number | null;
  end: number | null;
  operator: string | null;
  wcName: string;
  wcColor: string;
  operatorName: string;
  startLabel: string;
  endLabel: string;
  startDay: number | null;
}

export interface ScheduleResult {
  scheduled: ScheduledOp[];
  makespan: number;
  makespanLabel: string;
  log: string[];
  rationale: string[];
  dayMinutes: number;
}

interface Node {
  id: string;
  name: string;
  wc: string;
  minutes: number;
  mo: string;
  moProduct: string;
  priority: number;
  due: string;
  deps: string[];
  start: number | null;
  end: number | null;
  operator: string | null;
}

function toClock(absMin: number): { day: number; label: string } {
  const day = Math.floor(absMin / SHIFT_MINUTES);
  const within = absMin % SHIFT_MINUTES;
  const h = Math.floor((SHIFT_START + within) / 60);
  const m = (SHIFT_START + within) % 60;
  const d = new Date(DAY0 + "T00:00:00");
  d.setDate(d.getDate() + day);
  const dow = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return { day, label: `${dow} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
}

function buildNodes(mos: ManufacturingOrder[]): { nodes: Node[]; byId: Record<string, Node> } {
  const nodes: Node[] = [];
  const moLastOp: Record<string, string> = {};
  for (const mo of mos) {
    let prev: string | null = null;
    mo.operations.forEach((o) => {
      const node: Node = {
        id: o.id, name: o.name, wc: o.workCenter, minutes: o.minutes,
        mo: mo.id, moProduct: mo.product, priority: mo.priority, due: mo.due,
        deps: [], start: null, end: null, operator: null,
      };
      // Explicit per-task deps override the sequential default ([] = a parallel
      // root that waits on nothing); otherwise wait on the previous op in the MO.
      if (o.deps) node.deps.push(...o.deps);
      else if (prev) node.deps.push(prev); // sequential within MO
      nodes.push(node);
      prev = o.id;
    });
    if (prev) moLastOp[mo.id] = prev;
  }
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  // cross-MO deps: an MO's FIRST op waits on each child MO's LAST op
  for (const mo of mos) {
    if (!mo.childMOs || !mo.childMOs.length) continue;
    const first = mo.operations[0];
    if (!first) continue;
    const node = byId[first.id];
    for (const child of mo.childMOs) if (moLastOp[child]) node.deps.push(moLastOp[child]);
  }
  return { nodes, byId };
}

// critical-path length (minutes downstream) for tie-breaking
function criticalPath(nodes: Node[], byId: Record<string, Node>): Record<string, number> {
  const memo: Record<string, number> = {};
  const downstream: Record<string, string[]> = {};
  nodes.forEach((n) => n.deps.forEach((d) => (downstream[d] ||= []).push(n.id)));
  function cp(id: string): number {
    if (memo[id] != null) return memo[id];
    const n = byId[id];
    const outs = downstream[id] || [];
    memo[id] = n.minutes + (outs.length ? Math.max(...outs.map(cp)) : 0);
    return memo[id];
  }
  nodes.forEach((n) => cp(n.id));
  return memo;
}

export function schedule(
  workCenters: WorkCenter[],
  operators: Operator[],
  mos: ManufacturingOrder[]
): ScheduleResult {
  const wcById = Object.fromEntries(workCenters.map((w) => [w.id, w]));
  const activeOps = operators.filter((o) => o.active);
  const { nodes, byId } = buildNodes(mos);
  const cp = criticalPath(nodes, byId);

  // resource clocks
  const wcSlots: Record<string, number[]> = {}; // wcId -> array(capacity) of next-free times
  workCenters.forEach((w) => (wcSlots[w.id] = new Array(w.capacity).fill(0)));
  const opFree: Record<string, number> = {}; // operatorId -> next-free time
  activeOps.forEach((o) => (opFree[o.id] = 0));

  const done = new Set<string>();
  const remaining = new Set(nodes.map((n) => n.id));
  const log: string[] = [];
  let guard = 0;

  while (remaining.size && guard++ < 10000) {
    // ready = all deps done
    const ready = [...remaining].map((id) => byId[id]).filter((n) => n.deps.every((d) => done.has(d)));
    if (!ready.length) { log.push("Deadlock / unschedulable dependency detected."); break; }
    // smart ordering: priority (1 best) -> due date -> longest critical path
    ready.sort((a, b) =>
      a.priority - b.priority ||
      (a.due || "").localeCompare(b.due || "") ||
      cp[b.id] - cp[a.id]);

    const n = ready[0];
    const wc = wcById[n.wc];
    const depEnd = n.deps.length ? Math.max(...n.deps.map((d) => byId[d].end ?? 0)) : 0;

    // earliest free work-center slot
    let slotIdx = 0;
    let slotFree = wcSlots[n.wc] ? wcSlots[n.wc][0] : 0;
    if (wcSlots[n.wc]) wcSlots[n.wc].forEach((t, i) => { if (t < slotFree) { slotFree = t; slotIdx = i; } });

    // best operator skilled for this work center
    const candidates = activeOps.filter((o) => o.skills.includes(n.wc));
    let chosen: Operator | null = null;
    let chosenFree = Infinity;
    for (const o of candidates) if (opFree[o.id] < chosenFree) { chosen = o; chosenFree = opFree[o.id]; }

    const start = Math.max(depEnd, slotFree, chosen ? chosenFree : depEnd);
    const end = start + n.minutes;

    n.start = start; n.end = end;
    n.operator = chosen ? chosen.id : null;
    if (wcSlots[n.wc]) wcSlots[n.wc][slotIdx] = end;
    if (chosen) opFree[chosen.id] = end;

    if (!chosen) log.push(`No active operator skilled for ${wc ? wc.name : n.wc} — "${n.name}" (${n.mo}) left unassigned (station-blocked).`);
    done.add(n.id); remaining.delete(n.id);
  }

  const scheduled: ScheduledOp[] = nodes.map((n) => ({
    ...n,
    wcName: wcById[n.wc] ? wcById[n.wc].name : n.wc,
    wcColor: wcById[n.wc] ? wcById[n.wc].color : "#ddd",
    operatorName: n.operator ? (operators.find((o) => o.id === n.operator)?.name ?? "UNASSIGNED") : "UNASSIGNED",
    startLabel: n.start != null ? toClock(n.start).label : "",
    endLabel: n.end != null ? toClock(n.end).label : "",
    startDay: n.start != null ? toClock(n.start).day : null,
  }));

  const makespan = Math.max(0, ...scheduled.map((s) => s.end || 0));
  const rationale = buildRationale(scheduled, mos, operators, makespan, log);
  return { scheduled, makespan, makespanLabel: toClock(makespan).label, log, rationale, dayMinutes: SHIFT_MINUTES };
}

function buildRationale(
  scheduled: ScheduledOp[],
  mos: ManufacturingOrder[],
  operators: Operator[],
  makespan: number,
  log: string[]
): string[] {
  const lines: string[] = [];
  lines.push(`Scheduled ${scheduled.length} operations across ${operators.filter((o) => o.active).length} active operators.`);
  const byMo: Record<string, ScheduledOp[]> = {};
  scheduled.forEach((s) => { (byMo[s.mo] ||= []).push(s); });
  mos.slice().sort((a, b) => a.priority - b.priority).forEach((m) => {
    const ops = byMo[m.id] || [];
    if (!ops.length) return;
    const fin = Math.max(...ops.map((o) => o.end || 0));
    lines.push(`P${m.priority} ${m.product} (${m.id}) — finishes ${toClock(fin).label}; due ${m.due}.`);
  });
  const load: Record<string, number> = {};
  scheduled.forEach((s) => { if (s.operator) load[s.operatorName] = (load[s.operatorName] || 0) + s.minutes; });
  const loadStr = Object.entries(load).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 60).toFixed(1)}h`).join(", ");
  lines.push(`Operator load: ${loadStr || "none"}.`);
  lines.push(`Projected finish (makespan): ${toClock(makespan).label}.`);
  log.forEach((l) => lines.push("⚠ " + l));
  lines.push("Method: dependency-respecting list scheduling — ready operations ordered by MO priority, then due date, then longest critical path; each assigned to the earliest-free skilled operator and the earliest-free work-center slot.");
  return lines;
}

export { toClock };
