"use client";

// Production lines view. Shows the shop the way it actually runs: two material
// fabrication lines (Metal, Wood) that stay separate through the early stations,
// then converge into a shared finishing zone (Paint → Glass → Final Assembly /
// hardware) worked by one crew across both materials.

import {
  CURRENT_JOBS,
  MATERIAL_META,
  isSharedJob,
  materialsFor,
  allJobsUnique,
  type Material,
} from "@/lib/currentJobs";
import { FAB_STATIONS, FINISH_STATIONS, staffingForStation } from "@/lib/stations";
import { type Operator } from "@/lib/scheduler/seed";
import { Card, cx } from "@/components/ui";

export function LinesView({ operators }: { operators: Operator[] }) {
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="text-sm text-stone-600">
          Two fabrication lines run <b>separately</b> through{" "}
          <span className="text-stone-500">{FAB_STATIONS.map((s) => s.name).join(" · ")}</span>, then{" "}
          <b>converge</b> at the finishing zone — <b>{FINISH_STATIONS.map((s) => s.name).join(", ")}</b> (incl. hardware)
          are run by the same crew for wood and metal.
        </div>
      </Card>

      {/* Fabrication — separate material lines */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(["metal", "wood"] as Material[]).map((mat) => (
          <MaterialLane key={mat} material={mat} jobs={CURRENT_JOBS[mat]} />
        ))}
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
          <span className="text-xs text-stone-400">{allJobsUnique().length} jobs in the finishing queue</span>
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
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allJobsUnique().map((name) => (
            <JobChip key={name} name={name} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function MaterialLane({ material, jobs }: { material: Material; jobs: string[] }) {
  const m = MATERIAL_META[material];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: m.color }}>
        <span className="text-sm font-semibold">{m.label} line</span>
        <span className="rounded-full bg-black/15 px-2 py-0.5 text-xs font-semibold">{jobs.length} jobs</span>
      </div>
      <div className="divide-y divide-stone-100">
        {jobs.map((name, i) => {
          const shared = isSharedJob(name);
          return (
            <div key={name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: m.color }}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-stone-700">{name}</span>
              {shared && (
                <span className="rounded-full bg-walnut-50 px-2 py-0.5 text-[11px] font-medium text-walnut-700" title="Also runs in the other material — merges at finishing">
                  wood + metal
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function JobChip({ name }: { name: string }) {
  const mats = materialsFor(name);
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600">
      {mats.map((mat) => (
        <span key={mat} className="h-2 w-2 rounded-full" style={{ background: MATERIAL_META[mat].color }} title={MATERIAL_META[mat].label} />
      ))}
      {name}
    </span>
  );
}
