"use client";

// The shop-floor operator roster, backed by the shared InstantDB `mfgOperators`
// entity so add / remove / toggle persist and sync across terminals. On first
// run (empty table) it seeds itself once from the static roster in
// lib/scheduler/seed.ts, then becomes the source of truth.

import { useEffect, useMemo, useRef } from "react";
import { id } from "@instantdb/react";
import { idb } from "./instant";
import { OPERATORS, type Operator } from "./scheduler/seed";

export interface OperatorRow {
  id: string;
  name: string;
  active: boolean;
  skills?: string; // JSON array of work-center ids
  createdAt?: number;
}

function parseSkills(s?: string): string[] {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function useOperators(rows: OperatorRow[] | undefined, ready: boolean) {
  const seeded = useRef(false);

  // One-time seed from the static roster when the table is empty.
  useEffect(() => {
    if (!ready || seeded.current || !rows) return;
    if (rows.length === 0) {
      seeded.current = true;
      idb.transact(
        OPERATORS.map((o) =>
          idb.tx.mfgOperators[id()].update({
            name: o.name,
            active: o.active,
            skills: JSON.stringify(o.skills),
            createdAt: Date.now(),
          })
        )
      );
    }
  }, [ready, rows]);

  const operators: Operator[] = useMemo(
    () =>
      (rows ?? [])
        .map((r) => ({ id: r.id, name: r.name, active: !!r.active, skills: parseSkills(r.skills) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows]
  );

  const toggle = (opId: string) => {
    const r = (rows ?? []).find((x) => x.id === opId);
    if (!r) return;
    idb.transact(idb.tx.mfgOperators[opId].update({ active: !r.active }));
  };

  const add = (name: string, skills: string[], active = true) => {
    const clean = name.trim();
    if (!clean) return;
    idb.transact(
      idb.tx.mfgOperators[id()].update({
        name: clean,
        active,
        skills: JSON.stringify(skills),
        createdAt: Date.now(),
      })
    );
  };

  const remove = (opId: string) => idb.transact(idb.tx.mfgOperators[opId].delete());

  const seeding = ready && !!rows && rows.length === 0;
  return { operators, toggle, add, remove, seeding };
}
