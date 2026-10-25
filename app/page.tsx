"use client";

// Millwork Artisans — Production Floor.
// A standalone shop-floor management board that draws its jobs/units LIVE from
// the CRM Production Scheduler (shared InstantDB: mfgJobs / mfgUnits). Work is
// organized into the shop's 10 production stations; the dependency-aware engine
// suggests who runs each operation and when. Door A ships as a built-in sample
// so the board is never empty.

import { useMemo, useState } from "react";
import { idb } from "@/lib/instant";
import {
  STATIONS,
  floorOpsFromMOs,
  floorOpsFromUnits,
  staffingForStation,
  stationZone,
  type FloorOp,
} from "@/lib/stations";
import { MATERIAL_META } from "@/lib/currentJobs";
import {
  WORK_CENTERS,
  MANUFACTURING_ORDERS,
  type Operator,
} from "@/lib/scheduler/seed";
import {
  buildScheduleInput,
  parseLines,
  type Unit,
  type BomLine,
  type TaskLine,
} from "@/lib/scheduler/model";
import { schedule, type ScheduledOp, type ScheduleResult } from "@/lib/scheduler/engine";
import { STATUS_META, type FloorStatus } from "@/lib/floorStatus";
import { useSharedStatus, type OpStatusRow } from "@/lib/useSharedStatus";
import { CrewMatrix } from "@/components/CrewMatrix";
import { LinesView } from "@/components/LinesView";
import { JobsView } from "@/components/scheduler/JobsView";
import { UnitTypesView } from "@/components/scheduler/UnitTypesView";
import { AddEmployeeModal } from "@/components/entry";
import { useOperators, type OperatorRow } from "@/lib/useOperators";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SegmentedControl,
  SelectInput,
  cx,
} from "@/components/ui";

type View = "lines" | "board" | "schedule" | "jobs" | "types" | "crew";

const hrs = (min: number) => (min / 60).toFixed(min % 60 === 0 ? 0 : 1);

const PRIO_COLOR = ["#7a818c", "#b4485f", "#c98a17", "#5a8a3b", "#7a818c"];
const prioColor = (p: number) => PRIO_COLOR[p] ?? "#7a818c";

type JobRecord = { id: string; jobNumber?: string; name: string; customer?: string; dueDate?: number | string; address?: string };
type UnitRecord = {
  id: string; jobId: string; mark?: string; typeCode?: string; typeName?: string; category?: string;
  location?: string; description?: string; material?: string; finish?: string;
  qty?: number; width?: number; height?: number; thickness?: number; jambDepth?: number;
  priority?: number; due?: string; bom?: string; tasks?: string; sortOrder?: number;
};
const toUnit = (r: UnitRecord): Unit => ({ ...r, bom: parseLines<BomLine>(r.bom), tasks: parseLines<TaskLine>(r.tasks) });

export default function ProductionFloorPage() {
  const { isLoading, error, data } = idb.useQuery({ mfgJobs: {}, mfgUnits: {}, mfgOpStatus: {}, mfgOperators: {} });
  const [view, setView] = useState<View>("lines");
  const [scope, setScope] = useState<string>("__all"); // "__all" | "__sample" | jobId
  const [addEmpOpen, setAddEmpOpen] = useState(false);
  const statusRows = (data?.mfgOpStatus ?? []) as OpStatusRow[];
  const { map: statusMap, statusOf, cycle, reset } = useSharedStatus(statusRows);
  const operatorRows = (data?.mfgOperators ?? []) as OperatorRow[];
  const { operators, toggle: toggleOperator, add: addOperator, remove: removeOperator } = useOperators(operatorRows, !isLoading);

  const jobs = (data?.mfgJobs ?? []) as JobRecord[];
  const allUnits = (data?.mfgUnits ?? []) as UnitRecord[];
  const jobNameOf = (id: string) => jobs.find((j) => j.id === id)?.name;

  // No real jobs entered yet → fall back to the Door A sample automatically.
  const effectiveScope = scope === "__all" && allUnits.length === 0 ? "__sample" : scope;

  const eff = useMemo(() => {
    if (effectiveScope === "__sample") {
      return {
        sample: true,
        floorOps: floorOpsFromMOs(MANUFACTURING_ORDERS),
        sched: schedule(WORK_CENTERS, operators, MANUFACTURING_ORDERS),
        units: [] as Unit[],
        unitsWithoutTasks: 0,
      };
    }
    const units = (effectiveScope === "__all" ? allUnits : allUnits.filter((u) => u.jobId === effectiveScope)).map(toUnit);
    const inp = buildScheduleInput(units);
    return {
      sample: false,
      floorOps: floorOpsFromUnits(units, jobNameOf),
      sched: inp.mos.length ? schedule(inp.workCenters, operators, inp.mos) : null,
      units,
      unitsWithoutTasks: inp.unitsWithoutTasks,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveScope, allUnits, operators, jobs]);

  const schedById = useMemo(() => {
    const m: Record<string, ScheduledOp> = {};
    eff.sched?.scheduled.forEach((s) => (m[s.id] = s));
    return m;
  }, [eff.sched]);

  const byStation = useMemo(() => {
    const map: Record<string, FloorOp[]> = {};
    STATIONS.forEach((s) => (map[s.id] = []));
    eff.floorOps.forEach((op) => map[op.stationId]?.push(op));
    // within a station: active first, then queued by priority/due, done last
    const rank = (o: FloorOp): number => (statusOf(o.id) === "active" ? 0 : statusOf(o.id) === "done" ? 2 : 1);
    Object.values(map).forEach((ops) =>
      ops.sort((a, b) => rank(a) - rank(b) || a.priority - b.priority || (a.due || "").localeCompare(b.due || ""))
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eff.floorOps, statusMap]);

  // station load = remaining (not-done) minutes
  const stationMinutes = (ops: FloorOp[]) => ops.reduce((n, o) => n + (statusOf(o.id) === "done" ? 0 : o.minutes), 0);

  const bottleneckId = useMemo(() => {
    let best = "";
    let max = 0;
    for (const st of STATIONS) {
      if (st.kind !== "shop") continue;
      const m = stationMinutes(byStation[st.id] || []);
      if (m > max) { max = m; best = st.id; }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byStation, statusMap]);

  // KPIs
  const totalRemaining = STATIONS.reduce((n, st) => n + stationMinutes(byStation[st.id] || []), 0);
  const blocked = eff.sched?.scheduled.filter((s) => s.operatorName === "UNASSIGNED").length ?? 0;
  const unitCount = eff.sample ? MANUFACTURING_ORDERS.length : eff.units.length;
  const doneCount = eff.floorOps.filter((o) => statusOf(o.id) === "done").length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-walnut-800 bg-walnut-900 text-walnut-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">Millwork · Production Floor</span>
            <Badge color="#22c55e" soft={false}>live from CRM</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-walnut-200">
            {isLoading ? "Syncing…" : `${jobs.length} job${jobs.length === 1 ? "" : "s"} · ${allUnits.length} units in scheduler`}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <PageHeader
          title="Production Floor"
          subtitle="Jobs flow left → right through the shop's 10 stations. Drawn live from the CRM Production Scheduler."
          actions={
            <label className="flex items-center gap-2 text-sm text-stone-500">
              Job:
              <SelectInput value={scope} onChange={(e) => setScope(e.target.value)} className="w-56">
                <option value="__all">All open jobs</option>
                <option value="__sample">Door A (sample)</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.jobNumber ? `#${j.jobNumber} ` : ""}{j.name}</option>
                ))}
              </SelectInput>
            </label>
          }
        />

        {error && (
          <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn&apos;t reach the scheduler database: {error.message}. Showing whatever is cached.
          </Card>
        )}

        {/* KPI strip */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Units in scope" value={String(unitCount)} sub={`${doneCount} ops done`} />
          <Kpi label="Shop hours left" value={`${hrs(totalRemaining)}h`} sub="not-done operations" />
          <Kpi label="Projected finish" value={eff.sched?.makespanLabel?.split(" ").slice(0, 3).join(" ") || "—"} sub="auto-schedule makespan" />
          <Kpi
            label="Bottleneck"
            value={bottleneckId ? STATIONS.find((s) => s.id === bottleneckId)!.name : "—"}
            sub={bottleneckId ? `${hrs(stationMinutes(byStation[bottleneckId]))}h queued` : "balanced"}
            warn={!!bottleneckId}
          />
          <Kpi label="Station-blocked" value={String(blocked)} sub="no skilled operator" warn={blocked > 0} />
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: "lines", label: "Lines" },
              { value: "board", label: "Floor Board" },
              { value: "schedule", label: "Schedule" },
              { value: "jobs", label: "Jobs" },
              { value: "types", label: "Unit Types" },
              { value: "crew", label: "Crew" },
            ]}
          />
          {view === "board" && (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-stone-400 sm:inline">Status syncs live across terminals</span>
              <Button
                variant="subtle"
                onClick={() => { if (confirm("Clear live status for every operation on ALL terminals?")) reset(); }}
                className="text-xs"
              >
                Reset status
              </Button>
            </div>
          )}
          {view === "crew" && <Button onClick={() => setAddEmpOpen(true)}>+ Add employee</Button>}
        </div>

        {eff.unitsWithoutTasks > 0 && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {eff.unitsWithoutTasks} unit{eff.unitsWithoutTasks === 1 ? " has" : "s have"} no task routing yet — add tasks (or apply a unit type) in the CRM Production Scheduler and they&apos;ll appear here.
          </p>
        )}

        {view === "lines" && <LinesView operators={operators} />}
        {view === "board" && (
          <FloorBoard
            byStation={byStation}
            stationMinutes={stationMinutes}
            bottleneckId={bottleneckId}
            operators={operators}
            schedById={schedById}
            statusOf={statusOf}
            cycle={cycle}
          />
        )}
        {view === "schedule" && <ScheduleView result={eff.sched} />}
        {view === "jobs" && (
          <JobsView
            selectedJobId={scope !== "__all" && scope !== "__sample" ? scope : null}
            onSelectJob={(id) => setScope(id ?? "__all")}
          />
        )}
        {view === "types" && <UnitTypesView />}
        {view === "crew" && <CrewMatrix operators={operators} onToggle={toggleOperator} onDelete={removeOperator} />}
      </main>

      <AddEmployeeModal open={addEmpOpen} onClose={() => setAddEmpOpen(false)} onAdd={addOperator} />
    </div>
  );
}

/* --------------------------------------------------------------- KPI tile */

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <Card className="p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</div>
      <div className={cx("mt-1 truncate text-lg font-semibold", warn ? "text-amber-600" : "text-stone-800")} title={value}>{value}</div>
      {sub && <div className="text-xs text-stone-400">{sub}</div>}
    </Card>
  );
}

/* ------------------------------------------------------------ Floor board */

function FloorBoard({
  byStation,
  stationMinutes,
  bottleneckId,
  operators,
  schedById,
  statusOf,
  cycle,
}: {
  byStation: Record<string, FloorOp[]>;
  stationMinutes: (ops: FloorOp[]) => number;
  bottleneckId: string;
  operators: Operator[];
  schedById: Record<string, ScheduledOp>;
  statusOf: (id: string) => FloorStatus;
  cycle: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATIONS.map((st) => {
        const ops = byStation[st.id] || [];
        const mins = stationMinutes(ops);
        const activeN = ops.filter((o) => statusOf(o.id) === "active").length;
        const doneN = ops.filter((o) => statusOf(o.id) === "done").length;
        const crew = staffingForStation(st.id, operators).filter((o) => o.active);
        const isBottleneck = st.id === bottleneckId && mins > 0;
        const understaffed = st.kind === "shop" && ops.length > 0 && crew.length === 0;
        return (
          <div key={st.id} className="flex w-[290px] shrink-0 flex-col">
            <div className="rounded-t-xl px-3 py-2.5 text-white" style={{ backgroundColor: shade(st.color) }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{st.seq}. {st.name}</span>
                <span className="rounded-full bg-black/15 px-2 py-0.5 text-xs font-semibold">{ops.length}</span>
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-white/85">{st.blurb}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded bg-black/15 px-1.5 py-0.5">{hrs(mins)}h</span>
                {activeN > 0 && <span className="rounded bg-amber-300 px-1.5 py-0.5 font-medium text-amber-900">{activeN} active</span>}
                {doneN > 0 && <span className="rounded bg-green-300 px-1.5 py-0.5 font-medium text-green-900">{doneN} done</span>}
                {st.kind === "office" ? (
                  <span className="rounded bg-white/20 px-1.5 py-0.5">office</span>
                ) : (
                  <span className={cx("rounded px-1.5 py-0.5", understaffed ? "bg-red-300 text-red-900" : "bg-white/20")}>{crew.length} crew</span>
                )}
                {stationZone(st) === "finish" && <span className="rounded bg-white/20 px-1.5 py-0.5">wood + metal</span>}
                {isBottleneck && <span className="rounded bg-red-500 px-1.5 py-0.5 font-semibold text-white">bottleneck</span>}
              </div>
            </div>
            <div className="flex-1 space-y-2 rounded-b-xl border border-t-0 border-stone-200 bg-stone-50/70 p-2">
              {ops.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">No work queued</div>
              ) : stationZone(st) === "fab" ? (
                <MaterialBands ops={ops} schedById={schedById} statusOf={statusOf} cycle={cycle} />
              ) : (
                ops.map((op) => <OpCard key={op.id} op={op} sched={schedById[op.id]} status={statusOf(op.id)} onCycle={() => cycle(op.id)} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Within a fabrication station, split the queued work into material swim lanes.
// Finishing stations skip this and show one merged list.
const LANES: { key: string; label: string; color: string }[] = [
  { key: "metal", label: "Metal", color: MATERIAL_META.metal.color },
  { key: "wood", label: "Wood", color: MATERIAL_META.wood.color },
  { key: "both", label: "Wood + Metal", color: "#2950db" },
  { key: "unspec", label: "Unspecified", color: "#a8a29e" },
];

function MaterialBands({
  ops,
  schedById,
  statusOf,
  cycle,
}: {
  ops: FloorOp[];
  schedById: Record<string, ScheduledOp>;
  statusOf: (id: string) => FloorStatus;
  cycle: (id: string) => void;
}) {
  const groups: Record<string, FloorOp[]> = { metal: [], wood: [], both: [], unspec: [] };
  ops.forEach((op) => groups[op.material ?? "unspec"].push(op));
  return (
    <div className="space-y-3">
      {LANES.map((lane) => {
        const g = groups[lane.key];
        if (!g || g.length === 0) return null;
        return (
          <div key={lane.key}>
            <div className="mb-1 flex items-center gap-1.5 px-0.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: lane.color }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: lane.color }}>{lane.label}</span>
              <span className="text-[11px] text-stone-400">· {g.length}</span>
              <span className="h-px flex-1" style={{ background: lane.color + "44" }} />
            </div>
            <div className="space-y-2 border-l-2 pl-2" style={{ borderColor: lane.color + "88" }}>
              {g.map((op) => <OpCard key={op.id} op={op} sched={schedById[op.id]} status={statusOf(op.id)} onCycle={() => cycle(op.id)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OpCard({ op, sched, status, onCycle }: { op: FloorOp; sched?: ScheduledOp; status: FloorStatus; onCycle: () => void }) {
  const sm = STATUS_META[status];
  const operator = sched?.operatorName && sched.operatorName !== "UNASSIGNED" ? sched.operatorName : null;
  return (
    <div className={cx("rounded-lg border bg-white p-2.5 shadow-sm", status === "done" ? "border-stone-200 opacity-60" : "border-stone-200")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-stone-800" title={op.name}>{op.name}</div>
          <div className="truncate text-xs text-stone-500" title={op.product}>
            <span className="font-medium text-stone-600">{op.moId}</span> · {op.product}
          </div>
          {op.jobName && <div className="truncate text-[11px] text-stone-400">{op.jobName}</div>}
        </div>
        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: prioColor(op.priority) }} title={`Priority ${op.priority}`} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
          <span className="rounded bg-stone-100 px-1.5 py-0.5">{hrs(op.minutes)}h</span>
          {op.office ? (
            <span className="rounded bg-walnut-50 px-1.5 py-0.5 text-walnut-600">pre-production</span>
          ) : operator ? (
            <span className="rounded bg-walnut-50 px-1.5 py-0.5 capitalize text-walnut-700">{operator}</span>
          ) : (
            <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-600">unassigned</span>
          )}
        </div>
        <button
          onClick={onCycle}
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: sm.bg, color: sm.color }}
          title="Tap to advance status"
        >
          {sm.label}
        </button>
      </div>
    </div>
  );
}

// Darken a pastel work-center color for use as a station header background.
function shade(hex: string): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return "#334155";
  const f = 0.55;
  const r = Math.round(parseInt(m.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(m.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(m.slice(4, 6), 16) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

/* -------------------------------------------------------------- Schedule */

function ScheduleView({ result }: { result: ScheduleResult | null }) {
  if (!result) {
    return <EmptyState title="Nothing to schedule" hint="This job has no units with task routing yet. Add them in the CRM Production Scheduler." />;
  }
  const load: Record<string, number> = {};
  result.scheduled.forEach((s) => { if (s.operator) load[s.operatorName] = (load[s.operatorName] || 0) + s.minutes; });
  const loadRows = Object.entries(load).sort((a, b) => b[1] - a[1]);
  const maxLoad = Math.max(1, ...loadRows.map(([, v]) => v));

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="text-sm text-stone-500">
          Projected finish <span className="font-semibold text-stone-800">{result.makespanLabel}</span> · {result.scheduled.length} operations
        </div>
        <div className="mt-3 space-y-1.5">
          {loadRows.map(([name, mins]) => (
            <div key={name} className="grid grid-cols-[110px_1fr_48px] items-center gap-2">
              <span className="truncate text-right text-xs font-medium capitalize text-stone-600">{name}</span>
              <div className="h-4 rounded bg-stone-100">
                <div className="h-4 rounded bg-walnut-500" style={{ width: `${(mins / maxLoad) * 100}%` }} />
              </div>
              <span className="text-xs text-stone-500">{hrs(mins)}h</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2">Operation</th>
              <th className="px-3 py-2">Station</th>
              <th className="px-3 py-2">Operator</th>
              <th className="px-3 py-2">Unit</th>
            </tr>
          </thead>
          <tbody>
            {result.scheduled.slice().sort((a, b) => (a.start ?? 0) - (b.start ?? 0)).map((s) => (
              <tr key={s.id} className="border-b border-stone-50 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-stone-600">{s.startLabel}</td>
                <td className="whitespace-nowrap px-3 py-2 text-stone-600">{s.endLabel}</td>
                <td className="px-3 py-2 text-stone-700">{s.name}</td>
                <td className="px-3 py-2"><span className="rounded px-1.5 py-0.5 text-xs text-stone-700" style={{ background: s.wcColor }}>{s.wcName}</span></td>
                <td className={cx("px-3 py-2 capitalize", s.operatorName === "UNASSIGNED" ? "font-medium text-orange-600" : "text-stone-700")}>{s.operatorName}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-400">{s.mo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Scheduling rationale</div>
        <div className="space-y-1 text-sm">
          {result.rationale.map((r, i) => (
            <div key={i} className={cx("border-b border-stone-50 py-0.5 last:border-0", r.startsWith("⚠") && "text-orange-600")}>{r}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}

