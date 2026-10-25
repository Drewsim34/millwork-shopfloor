"use client";

import { useCallback, useEffect, useState } from "react";

// Per-terminal station status for each operation (Queued → Active → Done).
// Stored in localStorage so it survives refresh on a shop terminal. This is
// deliberately local for v1: shared, team-wide live status (operators tapping
// start/complete and everyone seeing it) would be a new InstantDB entity on the
// shared database — a follow-up, since it touches infra the CRM + mobile share.

export type FloorStatus = "queued" | "active" | "done";

export const NEXT_STATUS: Record<FloorStatus, FloorStatus> = {
  queued: "active",
  active: "done",
  done: "queued",
};

export const STATUS_META: Record<FloorStatus, { label: string; color: string; bg: string }> = {
  queued: { label: "Queued", color: "#78716c", bg: "#f5f5f4" },
  active: { label: "Active", color: "#b45309", bg: "#fef3c7" },
  done: { label: "Done", color: "#15803d", bg: "#dcfce7" },
};

const KEY = "shopfloor:status:v1";

export function useFloorStatus() {
  const [map, setMap] = useState<Record<string, FloorStatus>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setMap(JSON.parse(raw));
    } catch {
      /* private window / blocked storage — board still works, just unsaved */
    }
  }, []);

  const persist = (next: Record<string, FloorStatus>) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const cycle = useCallback((id: string) => {
    setMap((prev) => {
      const cur = prev[id] ?? "queued";
      const next = { ...prev, [id]: NEXT_STATUS[cur] };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setMap({});
    persist({});
  }, []);

  const statusOf = useCallback((id: string): FloorStatus => map[id] ?? "queued", [map]);

  return { statusOf, cycle, reset, map };
}
