"use client";

// Production lines view. Shows the shop the way it runs: two material fabrication
// lines (Metal, Wood) that stay separate through the early stations, then
// converge into a shared finishing zone (Paint → Glass → Final Assembly /
// hardware) worked by one crew. The lines are driven by the REAL jobs in the
// database (by each job's units' material), computed in lib/materialLines.ts;
// when there are no jobs yet it falls back to the seeded list.

import { MATERIAL_META, type Material } from "@/lib/currentJobs";
import { type LineJob } from "@/lib/materialLines";
import { FAB_STATIONS, FINISH_STATIONS, staffingForStation } from "@/lib/stations";
import { type Operator } from "@/lib/scheduler/seed";
import { Card, cx } from "@/components/ui";

export function LinesView({
  operators,
  metal,
  wood,
  fromSeed,
}: {
  operators: Operator[];
  metal: LineJob[];
  wood: LineJob[];
  fromSeed: boolean;
}) {
  const metalNames = new Set(metal.map((j) => j.name));
  const woodNames = new Set(wood.map((j) => j.name));
  const allNames: string[] = [];
  const seen = new Set<string>();
  for (const j of [...metal, ...wood]) if (!seen.has(j.name)) { seen.add(j.name); allNames.push(j.name); }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="text-sm text-stone-600">
          Two fabrication lines run <b>separately</b> through{" "}
          <span className="text-stone-500">{FAB_STATIONS.map((s) => s.name).join(" · ")}</span>, then{" "}
          <b>converge</b> at the finishing zone — <b>{FINISH_STATIONS.map((s) => s.name).join(", ")}</b> (incl. hardware)
          are run by the same crew for wood and metal.
        </div>
        {fromSeed && (
          <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
            Showing the seeded starting list. Add jobs (with a material on their units) and these lines fill from real jobs automatically.
          </div>
        )}
      </Card>

      {/* Fabrication — separate material lines */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MaterialLane material="metal" jobs={metal} />
        <MaterialLane material="wood" jobs={wood} />
      </div>

      {/* Convergence divider */}
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-gradient-to-r from-[#5b6b7a] to-walnut-500" />
        <span className="rounded-full bg-walnut-600 px-3 py-1 text-xs font-semibold text-white">
          ▼ lines merge — shared finishing crew ▼
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-[#9a6b3f] to-walnut-500" />
      </div>

      {/* Finishing — shared zone */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-700">Finishing — shared (wood + metal)</h3>
          <span className="text-xs text-stone-400">{allNames.length} job{allNames.length === 1 ? "" : "s"} in the finishing queue</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {FINISH_STATIONS.map((st) => {
            const crew = staffingForStation(st.id, operators).filter((o) => o.active);
            return (
              <div key={st.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: st.color }} />
                  <span className="text-sm font-semibold text-stone-700">{st.seq}. {st.name}</span>
                </div>
                <div className="mt-1 text-xs text-stone-500">{st.blurb}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {crew.length === 0 ? (
                    <span className="text-xs text-stone-400">unstaffed</span>
                  ) : (
                    crew.map((o) => (
                      <span key={o.id} className="rounded-full bg-white px-2 py-0.5 text-xs font-medium capitalize text-stone-600 ring-1 ring-stone-200">
                        {o.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {allNames.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {allNames.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600">
                {metalNames.has(name) && <span className="h-2 w-2 rounded-full" style={{ background: MATERIAL_META.metal.color }} title="Metal" />}
                {woodNames.has(name) && <span className="h-2 w-2 rounded-full" style={{ background: MATERIAL_META.wood.color }} title="Wood" />}
                {name}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function MaterialLane({ material, jobs }: { material: Material; jobs: LineJob[] }) {
  const m = MATERIAL_META[material];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: m.color }}>
        <span className="text-sm font-semibold">{m.label} line</span>
        <span className="rounded-full bg-black/15 px-2 py-0.5 text-xs font-semibold">{jobs.length} job{jobs.length === 1 ? "" : "s"}</span>
      </div>
      {jobs.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-stone-400">No {m.label.toLowerCase()} jobs</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {jobs.map((j, i) => (
            <div key={j.name + i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: m.color }}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-stone-700">{j.name}</span>
              {j.shared && (
                <span className="rounded-full bg-walnut-50 px-2 py-0.5 text-[11px] font-medium text-walnut-700" title="Runs in both materials — merges at finishing">
                  wood + metal
                </span>
              )}
              {j.unknown && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700" title="No material set on this job's units yet">
                  set material
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
