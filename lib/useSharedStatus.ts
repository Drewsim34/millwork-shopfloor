"use client";

// Team-wide live station status, backed by the shared InstantDB `mfgOpStatus`
// entity. One row per operation (opKey = the floor-board operation id). Every
// terminal subscribes to the same rows, so when one operator advances a card
// (Queued → Active → Done) everyone sees it in real time.
//
// Rows are created on first write (InstantDB creates the namespace/attributes
// on the fly), so no schema push is required to start using it.

import { useMemo } from "react";
import { id } from "@instantdb/react";
import { idb } from "./instant";
import { NEXT_STATUS, type FloorStatus } from "./floorStatus";

export interface OpStatusRow {
  id: string;
  opKey: string;
  status: string;
  updatedAt?: number;
  updatedBy?: string;
}

export function useSharedStatus(rows: OpStatusRow[]) {
  const { map, idByKey } = useMemo(() => {
    const map: Record<string, FloorStatus> = {};
    const idByKey: Record<string, string> = {};
    for (const r of rows) {
      if (!r.opKey) continue;
      map[r.opKey] = (r.status as FloorStatus) ?? "queued";
      idByKey[r.opKey] = r.id;
    }
    return { map, idByKey };
  }, [rows]);

  const statusOf = (opKey: string): FloorStatus => map[opKey] ?? "queued";

  // Advance Queued → Active → Done → Queued, writing to the shared DB.
  const cycle = (opKey: string, by?: string) => {
    const next = NEXT_STATUS[statusOf(opKey)];
    const rowId = idByKey[opKey] ?? id();
    idb.transact(
      idb.tx.mfgOpStatus[rowId].update({
        opKey,
        status: next,
        updatedAt: Date.now(),
        ...(by ? { updatedBy: by } : {}),
      })
    );
  };

  // Clear all live status (affects every terminal).
  const reset = () => {
    if (!rows.length) return;
    idb.transact(rows.map((r) => idb.tx.mfgOpStatus[r.id].delete()));
  };

  return { map, statusOf, cycle, reset };
}
