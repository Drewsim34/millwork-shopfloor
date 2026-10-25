"use client";

// Data-entry modals for the shop-floor app: add a job, add a unit (with a quick
// station routing), and add an employee. Jobs/units are written straight to the
// shared InstantDB (same entities the CRM Production Scheduler uses); employees
// go through the useOperators hook's `add`.

import { useState } from "react";
import { id } from "@instantdb/react";
import { idb } from "@/lib/instant";
import { STATIONS, defaultTaskWC, workCentersForStations } from "@/lib/stations";
import { Modal, Button, SelectInput, cx } from "@/components/ui";

const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500";
const input =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-walnut-500 focus:ring-2 focus:ring-walnut-500/20 placeholder:text-stone-400";

function toMs(dateStr: string): number | undefined {
  if (!dateStr) return undefined;
  const ms = new Date(dateStr + "T00:00:00").getTime();
  return isNaN(ms) ? undefined : ms;
}

/* ------------------------------------------------------------- Add Job */

export function AddJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [customer, setCustomer] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() { setName(""); setJobNumber(""); setCustomer(""); setDueDate(""); }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await idb.transact(
        idb.tx.mfgJobs[id()].update({
          name: name.trim(),
          jobNumber: jobNumber.trim() || undefined,
          customer: customer.trim() || undefined,
          dueDate: toMs(dueDate),
          createdAt: Date.now(),
        })
      );
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add job">
      <div className="space-y-3">
        <div>
          <span className={label}>Job name *</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 5555 Helena" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Job number</span>
            <input className={input} value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder="e.g. 5555" />
          </div>
          <div>
            <span className={label}>Due date</span>
            <input className={input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div>
          <span className={label}>Customer</span>
          <input className={input} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Builder / GC / owner" />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || !name.trim()}>{busy ? "Saving…" : "Add job"}</Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ Add Unit */

const DEFAULT_ROUTE = ["mill", "cnc", "assembly", "paint", "final"];

export function AddUnitModal({ open, onClose, jobId, jobName }: { open: boolean; onClose: () => void; jobId: string | null; jobName?: string }) {
  const [mark, setMark] = useState("");
  const [category, setCategory] = useState("Window");
  const [material, setMaterial] = useState("Wood");
  const [qty, setQty] = useState("1");
  const [priority, setPriority] = useState("3");
  const [due, setDue] = useState("");
  const [route, setRoute] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STATIONS.map((s) => [s.id, DEFAULT_ROUTE.includes(s.id)]))
  );
  const [mins, setMins] = useState<Record<string, string>>(() =>
    Object.fromEntries(STATIONS.map((s) => [s.id, "30"]))
  );
  const [busy, setBusy] = useState(false);

  function reset() {
    setMark(""); setCategory("Window"); setMaterial("Wood"); setQty("1"); setPriority("3"); setDue("");
    setRoute(Object.fromEntries(STATIONS.map((s) => [s.id, DEFAULT_ROUTE.includes(s.id)])));
    setMins(Object.fromEntries(STATIONS.map((s) => [s.id, "30"])));
  }

  async function save() {
    if (!jobId || !mark.trim()) return;
    // Build task routing in flow order from the ticked stations.
    const tasks = STATIONS.filter((s) => route[s.id]).map((s, i) => ({
      step: i + 1,
      name: s.name,
      workCenter: defaultTaskWC(s),
      minutes: Math.max(1, parseInt(mins[s.id] || "30", 10) || 30),
    }));
    setBusy(true);
    try {
      await idb.transact(
        idb.tx.mfgUnits[id()].update({
          jobId,
          mark: mark.trim(),
          category,
          material,
          qty: Math.max(1, parseInt(qty, 10) || 1),
          priority: Math.min(4, Math.max(1, parseInt(priority, 10) || 3)),
          due: due || undefined,
          tasks: JSON.stringify(tasks),
          createdAt: Date.now(),
        })
      );
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={jobName ? `Add unit to ${jobName}` : "Add unit"} wide>
      {!jobId ? (
        <p className="text-sm text-stone-500">Pick a job first, then add units to it.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <span className={label}>Mark / unit # *</span>
              <input className={input} value={mark} onChange={(e) => setMark(e.target.value)} placeholder="e.g. 3F" autoFocus />
            </div>
            <div>
              <span className={label}>Category</span>
              <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Window</option><option>Door</option><option>Other</option>
              </SelectInput>
            </div>
            <div>
              <span className={label}>Material</span>
              <SelectInput value={material} onChange={(e) => setMaterial(e.target.value)}>
                <option>Wood</option><option>Metal</option><option>Both</option>
              </SelectInput>
            </div>
            <div>
              <span className={label}>Qty</span>
              <input className={input} type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <span className={label}>Priority (1=top)</span>
              <SelectInput value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
              </SelectInput>
            </div>
            <div>
              <span className={label}>Due date</span>
              <input className={input} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            <span className={label}>Routing — stations &amp; minutes</span>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {STATIONS.map((s) => (
                <label key={s.id} className={cx("flex items-center gap-2 rounded-lg border px-2.5 py-1.5", route[s.id] ? "border-walnut-300 bg-walnut-50" : "border-stone-200 bg-white")}>
                  <input type="checkbox" checked={!!route[s.id]} onChange={(e) => setRoute((r) => ({ ...r, [s.id]: e.target.checked }))} />
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                  <span className="flex-1 text-sm text-stone-700">{s.seq}. {s.name}</span>
                  <input
                    className="w-16 rounded border border-stone-300 px-1.5 py-0.5 text-right text-xs"
                    type="number" min="1" value={mins[s.id]}
                    onChange={(e) => setMins((m) => ({ ...m, [s.id]: e.target.value }))}
                    disabled={!route[s.id]}
                  />
                  <span className="text-[11px] text-stone-400">min</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="subtle" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={busy || !mark.trim()}>{busy ? "Saving…" : "Add unit"}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------- Add Employee */

export function AddEmployeeModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, skills: string[], active: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [caps, setCaps] = useState<Record<string, boolean>>({});

  function reset() { setName(""); setActive(true); setCaps({}); }

  function save() {
    if (!name.trim()) return;
    const stationIds = STATIONS.filter((s) => caps[s.id]).map((s) => s.id);
    onAdd(name.trim(), workCentersForStations(stationIds), active);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add employee">
      <div className="space-y-3">
        <div>
          <span className={label}>Name *</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
        </div>
        <div>
          <span className={label}>Capable stations</span>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {STATIONS.map((s) => (
              <label key={s.id} className={cx("flex items-center gap-2 rounded-lg border px-2.5 py-1.5", caps[s.id] ? "border-walnut-300 bg-walnut-50" : "border-stone-200 bg-white")}>
                <input type="checkbox" checked={!!caps[s.id]} onChange={(e) => setCaps((c) => ({ ...c, [s.id]: e.target.checked }))} />
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="text-sm text-stone-700">{s.seq}. {s.name}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active (available for scheduling)
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!name.trim()}>Add employee</Button>
      </div>
    </Modal>
  );
}
