"use client";

// Completion-date rollup. Watches the shared live op-status and stamps:
//   • mfgUnits.completedAt  — when every one of a unit's operations is Done
//   • mfgJobs.completedAt   — when every tasked unit in the job is complete
// and clears the stamp if work is re-opened. These dates are what the CRM reads
// back (the shop-floor app owns scheduling/execution; the CRM consumes
// completion). Runs on any terminal watching the board, so it reacts to a
// "Done" tap from anywhere.

import { useEffect, useRef } from "react";
import { idb } from "./instant";
import { parseLines, type TaskLine } from "./scheduler/model";
import { type FloorStatus } from "./floorStatus";

interface UnitRec { id: string; jobId: string; tasks?: string; completedAt?: string }
interface JobRec { id: string; completedAt?: string }

export function useCompletionSync(
  units: UnitRec[],
  jobs: JobRec[],
  statusMap: Record<string, FloorStatus>,
  ready: boolean
) {
  // Attempt each distinct set of changes only once, so a rejected write can't
  // loop. Cleared implicitly: once a write lands, the data changes and the next
  // computed signature differs (empty), so settled state produces no writes.
  const lastSig = useRef("");

  useEffect(() => {
    if (!ready) return;
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txns: any[] = [];
    const sig: string[] = [];

    const taskCount: Record<string, number> = {};
    const unitComplete: Record<string, boolean> = {};

    for (const u of units) {
      const n = parseLines<TaskLine>(u.tasks).length;
      taskCount[u.id] = n;
      const complete = n > 0 && Array.from({ length: n }, (_, i) => statusMap[`${u.id}__t${i}`]).every((s) => s === "done");
      unitComplete[u.id] = complete;
      if (complete && !u.completedAt) { txns.push(idb.tx.mfgUnits[u.id].update({ completedAt: now })); sig.push(`u+${u.id}`); }
      else if (!complete && u.completedAt) { txns.push(idb.tx.mfgUnits[u.id].update({ completedAt: null })); sig.push(`u-${u.id}`); }
    }

    for (const j of jobs) {
      const jobUnits = units.filter((u) => u.jobId === j.id);
      const hasTasked = jobUnits.some((u) => taskCount[u.id] > 0);
      // complete = at least one tasked unit, and every tasked unit is complete
      const allDone = hasTasked && jobUnits.every((u) => taskCount[u.id] === 0 || unitComplete[u.id]);
      if (allDone && !j.completedAt) { txns.push(idb.tx.mfgJobs[j.id].update({ completedAt: now })); sig.push(`j+${j.id}`); }
      else if (!allDone && j.completedAt) { txns.push(idb.tx.mfgJobs[j.id].update({ completedAt: null })); sig.push(`j-${j.id}`); }
    }

    const signature = sig.sort().join("|");
    if (signature && signature !== lastSig.current) {
      lastSig.current = signature;
      idb.transact(txns);
    }
  }, [units, jobs, statusMap, ready]);
}
