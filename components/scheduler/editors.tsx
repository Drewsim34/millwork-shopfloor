"use client";

// Inline editors for a bill-of-materials and a task routing, reused by both the
// unit-type catalog and the per-unit editor. Ported from the CRM Production
// Scheduler.

import { type BomLine, type TaskLine, mapWorkCenter } from "@/lib/scheduler/model";
import { WORK_CENTERS } from "@/lib/scheduler/seed";

const inputCls =
  "w-full rounded border border-stone-300 px-2 py-1 text-sm outline-none focus:border-walnut-500";

export function BomEditor({
  lines,
  onChange,
}: {
  lines: BomLine[];
  onChange: (l: BomLine[]) => void;
}) {
  const set = (i: number, patch: Partial<BomLine>) =>
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const add = () => onChange([...lines, { name: "", makeBuy: "Buy" }]);
  const del = (i: number) => onChange(lines.filter((_, j) => j !== i));

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
            <th className="py-1 pr-1 font-medium">Code</th>
            <th className="pr-1 font-medium">Component</th>
            <th className="w-14 pr-1 font-medium">Qty</th>
            <th className="w-24 pr-1 font-medium">Make/Buy</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="pr-1 py-0.5">
                <input className={inputCls} value={l.code || ""} onChange={(e) => set(i, { code: e.target.value })} />
              </td>
              <td className="pr-1 py-0.5">
                <input className={inputCls} value={l.name} onChange={(e) => set(i, { name: e.target.value })} />
              </td>
              <td className="pr-1 py-0.5">
                <input
                  className={inputCls}
                  type="number"
                  value={l.qty ?? ""}
                  onChange={(e) => set(i, { qty: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </td>
              <td className="pr-1 py-0.5">
                <select className={inputCls} value={l.makeBuy || "Buy"} onChange={(e) => set(i, { makeBuy: e.target.value })}>
                  <option>Buy</option>
                  <option>Make</option>
                </select>
              </td>
              <td className="py-0.5 text-center">
                <button onClick={() => del(i)} className="text-stone-400 hover:text-red-600" aria-label="Remove">
                  ✕
                </button>
              </td>
            </tr>
          ))}
          {!lines.length && (
            <tr>
              <td colSpan={5} className="py-2 text-center text-xs text-stone-400">
                No components yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button onClick={add} className="mt-1 text-xs font-medium text-walnut-700 hover:underline">
        + Add component
      </button>
    </div>
  );
}

export function TasksEditor({
  lines,
  onChange,
}: {
  lines: TaskLine[];
  onChange: (l: TaskLine[]) => void;
}) {
  const set = (i: number, patch: Partial<TaskLine>) =>
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const add = () =>
    onChange([...lines, { step: lines.length + 1, name: "", workCenter: "", minutes: 30 }]);
  const del = (i: number) => onChange(lines.filter((_, j) => j !== i));

  return (
    <div>
      <datalist id="wc-options">
        {WORK_CENTERS.map((w) => (
          <option key={w.id} value={w.name} />
        ))}
      </datalist>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-stone-400">
            <th className="w-10 py-1 pr-1 font-medium">#</th>
            <th className="pr-1 font-medium">Process</th>
            <th className="pr-1 font-medium">Work center</th>
            <th className="w-16 pr-1 font-medium">Min</th>
            <th className="w-12 pr-1 text-center font-medium">Skl</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const m = mapWorkCenter(l.workCenter);
            const hint = !l.workCenter
              ? ""
              : m.office
              ? "pre-production — not scheduled"
              : !m.known
              ? "new station (no operator yet)"
              : "";
            return (
              <tr key={i}>
                <td className="pr-1 py-0.5">
                  <input
                    className={inputCls}
                    type="number"
                    value={l.step ?? ""}
                    onChange={(e) => set(i, { step: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </td>
                <td className="pr-1 py-0.5">
                  <input className={inputCls} value={l.name} onChange={(e) => set(i, { name: e.target.value })} />
                </td>
                <td className="pr-1 py-0.5">
                  <input
                    className={inputCls}
                    list="wc-options"
                    value={l.workCenter}
                    onChange={(e) => set(i, { workCenter: e.target.value })}
                  />
                  {hint && <span className="text-[10px] text-orange-500">{hint}</span>}
                </td>
                <td className="pr-1 py-0.5">
                  <input
                    className={inputCls}
                    type="number"
                    value={l.minutes ?? ""}
                    onChange={(e) => set(i, { minutes: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="pr-1 py-0.5 text-center">
                  <input type="checkbox" checked={!!l.skilled} onChange={(e) => set(i, { skilled: e.target.checked })} />
                </td>
                <td className="py-0.5 text-center">
                  <button onClick={() => del(i)} className="text-stone-400 hover:text-red-600" aria-label="Remove">
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
          {!lines.length && (
            <tr>
              <td colSpan={6} className="py-2 text-center text-xs text-stone-400">
                No tasks yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button onClick={add} className="mt-1 text-xs font-medium text-walnut-700 hover:underline">
        + Add task
      </button>
    </div>
  );
}
