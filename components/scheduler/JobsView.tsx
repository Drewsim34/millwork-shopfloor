"use client";

// Jobs + units manager. Create jobs, add/edit units (each with its own BoM and
// task routing copied from a unit type), and import a takeoff workbook. Ported
// from the CRM Production Scheduler — this app is now the system of record.

import { useMemo, useState } from "react";
import { id } from "@instantdb/react";
import { idb } from "@/lib/instant";
import { Button, Card, Badge, Modal, Field, TextInput, SelectInput, EmptyState, cx } from "@/components/ui";
import { BomEditor, TasksEditor } from "@/components/scheduler/editors";
import {
  parseLines,
  UNIT_CATEGORIES,
  type Unit,
  type UnitType,
  type BomLine,
  type TaskLine,
} from "@/lib/scheduler/model";
import {
  parseTakeoffWorkbook,
  unitsFromMapping,
  type ParsedUnit,
  type ParsedTakeoff,
  type ColumnMapping,
} from "@/lib/scheduler/import";

/* --------------------------------------------------------- record mappers */

type JobRecord = { id: string; jobNumber?: string; name: string; address?: string; customer?: string; dueDate?: string; notes?: string };
type UnitRecord = {
  id: string; jobId: string; mark?: string; typeCode?: string; typeName?: string; category?: string;
  location?: string; description?: string; material?: string; finish?: string;
  qty?: number; width?: number; height?: number; thickness?: number; jambDepth?: number;
  priority?: number; due?: string; bom?: string; tasks?: string; sortOrder?: number;
};
type TypeRecord = { id: string; code: string; name: string; category?: string; material?: string; bom?: string; tasks?: string };

const toUnit = (r: UnitRecord): Unit => ({
  ...r,
  bom: parseLines<BomLine>(r.bom),
  tasks: parseLines<TaskLine>(r.tasks),
});
const toType = (r: TypeRecord): UnitType => ({
  id: r.id, code: r.code, name: r.name, category: r.category, material: r.material,
  bom: parseLines<BomLine>(r.bom), tasks: parseLines<TaskLine>(r.tasks),
});

const UNIT_FIELDS: (keyof ParsedUnit)[] = [
  "mark", "typeCode", "location", "description", "material", "finish", "qty", "width", "height", "thickness", "jambDepth",
];

/* ------------------------------------------------------------------ view */

export function JobsView({
  selectedJobId,
  onSelectJob,
}: {
  selectedJobId: string | null;
  onSelectJob: (id: string | null) => void;
}) {
  const { data } = idb.useQuery({ mfgJobs: {}, mfgUnits: {}, mfgUnitTypes: {} });
  const jobs = ((data?.mfgJobs ?? []) as JobRecord[]).slice().sort((a, b) => (b.jobNumber || "").localeCompare(a.jobNumber || ""));
  const allUnits = (data?.mfgUnits ?? []) as UnitRecord[];
  const types = ((data?.mfgUnitTypes ?? []) as TypeRecord[]).map(toType);

  const current = jobs.find((j) => j.id === selectedJobId) || null;
  const units = useMemo(
    () => allUnits.filter((u) => u.jobId === selectedJobId).map(toUnit).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allUnits, selectedJobId]
  );

  const [editJob, setEditJob] = useState<JobRecord | null>(null);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [importing, setImporting] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* jobs list */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Jobs</span>
          <Button variant="subtle" className="px-2 py-1 text-xs" onClick={() => setEditJob({ id: "", name: "" })}>+ New</Button>
        </div>
        <div className="space-y-1">
          {jobs.length === 0 && <p className="px-1 text-sm text-stone-400">No jobs yet.</p>}
          {jobs.map((j) => {
            const n = allUnits.filter((u) => u.jobId === j.id).length;
            return (
              <button
                key={j.id}
                onClick={() => onSelectJob(j.id)}
                className={cx(
                  "block w-full rounded-lg px-3 py-2 text-left",
                  selectedJobId === j.id ? "bg-walnut-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                )}
              >
                <div className="text-sm font-medium">{j.jobNumber ? `#${j.jobNumber.replace(/^#+\s*/, "")} ` : ""}{j.name}</div>
                <div className={cx("text-xs", selectedJobId === j.id ? "text-walnut-100" : "text-stone-400")}>
                  {n} unit{n === 1 ? "" : "s"}{j.customer ? ` · ${j.customer}` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* units of selected job */}
      <div>
        {!current ? (
          <EmptyState title="Select or create a job" hint="Create a job, then add units by hand or import a takeoff workbook." />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-stone-800">{current.jobNumber ? `#${current.jobNumber.replace(/^#+\s*/, "")} ` : ""}{current.name}</h2>
                <p className="text-sm text-stone-500">
                  {[current.customer, current.address].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" className="text-xs" onClick={() => setEditJob(current)}>Edit job</Button>
                <Button variant="subtle" onClick={() => setImporting(true)}>⬆ Import takeoff</Button>
                <Button onClick={() => setEditUnit(newUnit(current.id))}>+ Add unit</Button>
              </div>
            </div>

            {units.length === 0 ? (
              <EmptyState title="No units in this job" hint="Add a unit, or import a takeoff Excel." />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-400">
                      <th className="px-3 py-2">Mark</th>
                      <th className="px-3 py-2">Type / description</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">W×H</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Tasks</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.id} className="border-b border-stone-50 last:border-0">
                        <td className="px-3 py-2 font-medium text-stone-700">{u.mark || "—"}</td>
                        <td className="px-3 py-2 text-stone-700">
                          {u.typeCode && <span className="mr-1 text-xs text-stone-400">{u.typeCode}</span>}
                          {u.description || u.typeName || "—"}
                          {u.material && <span className="ml-1 text-xs text-stone-400">· {u.material}</span>}
                        </td>
                        <td className="px-3 py-2">{u.qty ?? 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-stone-500">{u.width || "?"}×{u.height || "?"}</td>
                        <td className="px-3 py-2 text-stone-500">{u.location || "—"}</td>
                        <td className="px-3 py-2">
                          {u.tasks.length ? <Badge color="#3b8a52">{u.tasks.length}</Badge> : <span className="text-xs text-orange-500">none</span>}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button className="text-xs text-walnut-700 hover:underline" onClick={() => setEditUnit(u)}>Edit</button>
                          <button
                            className="ml-3 text-xs text-red-600 hover:underline"
                            onClick={() => { if (confirm("Delete this unit?")) idb.transact(idb.tx.mfgUnits[u.id].delete()); }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </div>

      {editJob && <JobEditor job={editJob} onClose={() => setEditJob(null)} onSaved={onSelectJob} />}
      {editUnit && <UnitEditor unit={editUnit} types={types} onClose={() => setEditUnit(null)} />}
      {importing && current && (
        <ImportTakeoff
          types={types}
          currentJob={current}
          onClose={() => setImporting(false)}
          onSelectJob={onSelectJob}
        />
      )}
    </div>
  );
}

const newUnit = (jobId: string): Unit => ({ id: "", jobId, qty: 1, priority: 3, bom: [], tasks: [] });

/* ------------------------------------------------------------- job editor */

function JobEditor({ job, onClose, onSaved }: { job: JobRecord; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({
    jobNumber: job.jobNumber || "", name: job.name || "", customer: job.customer || "",
    address: job.address || "", dueDate: job.dueDate ? job.dueDate.slice(0, 10) : "", notes: job.notes || "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  function save() {
    if (!f.name.trim()) { alert("Job name is required."); return; }
    const now = new Date().toISOString();
    const recId = job.id || id();
    idb.transact(
      idb.tx.mfgJobs[recId].update({
        jobNumber: f.jobNumber.trim().replace(/^#+\s*/, "") || undefined,
        name: f.name.trim(),
        customer: f.customer.trim() || undefined,
        address: f.address.trim() || undefined,
        dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : undefined,
        notes: f.notes.trim() || undefined,
        updatedAt: now,
        ...(job.id ? {} : { createdAt: now }),
      })
    );
    onSaved(recId);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={job.id ? "Edit job" : "New job"}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job number"><TextInput value={f.jobNumber} onChange={set("jobNumber")} placeholder="5536" /></Field>
        <Field label="Job name"><TextInput value={f.name} onChange={set("name")} placeholder="Wyecliff" /></Field>
        <Field label="Customer"><TextInput value={f.customer} onChange={set("customer")} /></Field>
        <Field label="Due date"><TextInput type="date" value={f.dueDate} onChange={set("dueDate")} /></Field>
        <Field label="Address" className="col-span-2"><TextInput value={f.address} onChange={set("address")} /></Field>
      </div>
      <div className="mt-4 flex justify-between">
        {job.id ? (
          <Button variant="danger" onClick={() => { if (confirm("Delete this job? Units stay but become orphaned.")) { idb.transact(idb.tx.mfgJobs[job.id].delete()); onClose(); } }}>
            Delete job
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save job</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ unit editor */

function UnitEditor({ unit, types, onClose }: { unit: Unit; types: UnitType[]; onClose: () => void }) {
  const [f, setF] = useState({
    mark: unit.mark || "", typeCode: unit.typeCode || "", description: unit.description || "",
    location: unit.location || "", material: unit.material || "", finish: unit.finish || "",
    category: unit.category || "Door",
    qty: unit.qty ?? 1, width: unit.width ?? undefined, height: unit.height ?? undefined,
    priority: unit.priority ?? 3, due: unit.due ? unit.due.slice(0, 10) : "",
  });
  const [typeName, setTypeName] = useState(unit.typeName || "");
  const [bom, setBom] = useState<BomLine[]>(unit.bom);
  const [tasks, setTasks] = useState<TaskLine[]>(unit.tasks);

  function applyType(typeId: string) {
    const t = types.find((x) => x.id === typeId);
    if (!t) return;
    setF((p) => ({ ...p, typeCode: t.code, category: t.category || p.category, material: t.material || p.material, description: p.description || t.name }));
    setTypeName(t.name);
    setBom(t.bom.map((b) => ({ ...b })));
    setTasks(t.tasks.map((t2) => ({ ...t2 })));
  }

  function save() {
    const now = new Date().toISOString();
    const recId = unit.id || id();
    idb.transact(
      idb.tx.mfgUnits[recId].update({
        jobId: unit.jobId,
        mark: f.mark.trim() || undefined,
        typeCode: f.typeCode.trim() || undefined,
        typeName: typeName.trim() || undefined,
        category: f.category,
        description: f.description.trim() || undefined,
        location: f.location.trim() || undefined,
        material: f.material.trim() || undefined,
        finish: f.finish.trim() || undefined,
        qty: Number(f.qty) || 1,
        width: f.width != null ? Number(f.width) : undefined,
        height: f.height != null ? Number(f.height) : undefined,
        priority: Number(f.priority) || 3,
        due: f.due ? new Date(f.due).toISOString() : undefined,
        bom: JSON.stringify(bom),
        tasks: JSON.stringify(tasks),
        updatedAt: now,
        ...(unit.id ? {} : { createdAt: now }),
      })
    );
    onClose();
  }

  const setN = (k: "mark" | "typeCode" | "description" | "location" | "material" | "finish" | "due") =>
    (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Modal open onClose={onClose} title={unit.id ? `Edit unit ${unit.mark || ""}` : "Add unit"} wide>
      {types.length > 0 && (
        <div className="mb-3 rounded-lg bg-stone-50 p-2.5">
          <Field label="Apply unit type (copies its BoM + tasks)">
            <SelectInput defaultValue="" onChange={(e) => applyType(e.target.value)}>
              <option value="">— choose a type —</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
            </SelectInput>
          </Field>
        </div>
      )}
      <div className="grid grid-cols-4 gap-3">
        <Field label="Mark"><TextInput value={f.mark} onChange={setN("mark")} placeholder="3F" /></Field>
        <Field label="Type code"><TextInput value={f.typeCode} onChange={setN("typeCode")} /></Field>
        <Field label="Category">
          <SelectInput value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}>
            {UNIT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </SelectInput>
        </Field>
        <Field label="Qty"><TextInput type="number" value={f.qty} onChange={(e) => setF((p) => ({ ...p, qty: Number(e.target.value) }))} /></Field>
        <Field label="Description" className="col-span-2"><TextInput value={f.description} onChange={setN("description")} /></Field>
        <Field label="Location"><TextInput value={f.location} onChange={setN("location")} /></Field>
        <Field label="Material"><TextInput value={f.material} onChange={setN("material")} /></Field>
        <Field label="Width"><TextInput type="number" value={f.width ?? ""} onChange={(e) => setF((p) => ({ ...p, width: e.target.value === "" ? undefined : Number(e.target.value) }))} /></Field>
        <Field label="Height"><TextInput type="number" value={f.height ?? ""} onChange={(e) => setF((p) => ({ ...p, height: e.target.value === "" ? undefined : Number(e.target.value) }))} /></Field>
        <Field label="Priority (1=top)"><TextInput type="number" value={f.priority} onChange={(e) => setF((p) => ({ ...p, priority: Number(e.target.value) }))} /></Field>
        <Field label="Due date"><TextInput type="date" value={f.due} onChange={setN("due")} /></Field>
      </div>

      <div className="mt-4">
        <h3 className="mb-1 text-sm font-semibold text-stone-700">Bill of materials</h3>
        <BomEditor lines={bom} onChange={setBom} />
      </div>
      <div className="mt-4">
        <h3 className="mb-1 text-sm font-semibold text-stone-700">Tasks / routing</h3>
        <TasksEditor lines={tasks} onChange={setTasks} />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save unit</Button>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------- takeoff import */

function ImportTakeoff({
  types,
  currentJob,
  onClose,
  onSelectJob,
}: {
  types: UnitType[];
  currentJob: JobRecord;
  onClose: () => void;
  onSelectJob: (id: string) => void;
}) {
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedTakeoff | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [target, setTarget] = useState<"new" | "current">("current");
  const [applyTypeId, setApplyTypeId] = useState("");
  const [picked, setPicked] = useState<boolean[]>([]);

  // manual mapping state
  const [manualSheet, setManualSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [cols, setCols] = useState<Partial<Record<keyof ParsedUnit, number>>>({});
  const [manualCat, setManualCat] = useState("Door");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErr(null);
    try {
      const ab = await file.arrayBuffer();
      setBuf(ab);
      const p = parseTakeoffWorkbook(ab);
      setParsed(p);
      setTarget(p.job.name ? "new" : "current");
      setPicked(p.units.map(() => true));
      if (!p.autodetected && p.sheets.length) {
        const guess = p.sheets.find((s) => /window|door/i.test(s.name)) || p.sheets[0];
        setManualSheet(guess.name);
      }
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not read that file.");
      setParsed(null);
    }
  }

  // resolve the units to import (auto-detected, or from manual mapping)
  const manualUnits = useMemo<ParsedUnit[]>(() => {
    if (!buf || !parsed || parsed.autodetected || !manualSheet) return [];
    try {
      const map: ColumnMapping = { sheet: manualSheet, headerRow, category: manualCat, cols };
      return unitsFromMapping(buf, map);
    } catch {
      return [];
    }
  }, [buf, parsed, manualSheet, headerRow, cols, manualCat]);

  const autoUnits = parsed?.autodetected ? parsed.units.filter((_, i) => picked[i]) : [];
  const unitsToImport = parsed?.autodetected ? autoUnits : manualUnits;

  function doImport() {
    if (!parsed || !unitsToImport.length) return;
    const now = new Date().toISOString();
    let jobId = currentJob.id;
    const txns = [];

    if (target === "new") {
      jobId = id();
      txns.push(
        idb.tx.mfgJobs[jobId].update({
          jobNumber: parsed.job.jobNumber || undefined,
          name: parsed.job.name || fileName.replace(/\.[^.]+$/, ""),
          address: parsed.job.address || undefined,
          customer: parsed.job.customer || undefined,
          createdAt: now,
          updatedAt: now,
        })
      );
    }

    const applied = types.find((t) => t.id === applyTypeId);
    unitsToImport.forEach((u, i) => {
      txns.push(
        idb.tx.mfgUnits[id()].update({
          jobId,
          mark: u.mark || undefined,
          typeCode: applied?.code || u.typeCode || undefined,
          typeName: applied?.name || undefined,
          category: u.category || applied?.category || undefined,
          location: u.location || undefined,
          description: u.description || undefined,
          material: u.material || undefined,
          finish: u.finish || undefined,
          qty: u.qty || 1,
          width: u.width,
          height: u.height,
          thickness: u.thickness,
          jambDepth: u.jambDepth,
          priority: 3,
          sortOrder: i,
          bom: JSON.stringify(applied ? applied.bom : []),
          tasks: JSON.stringify(applied ? applied.tasks : []),
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    idb.transact(txns);
    onSelectJob(jobId);
    onClose();
  }

  const rawSheet = parsed?.sheets.find((s) => s.name === manualSheet);
  const headerCells = rawSheet?.rows[headerRow] || [];

  return (
    <Modal open onClose={onClose} title="Import takeoff" wide>
      <input
        type="file"
        accept=".xlsx,.xlsm,.xls"
        onChange={onFile}
        className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-walnut-600 file:px-3 file:py-2 file:text-white"
      />
      {fileName && <p className="mt-1 text-xs text-stone-400">{fileName}</p>}
      {err && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}

      {parsed && (
        <>
          {/* target + apply-type */}
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-stone-50 p-3">
            <Field label="Import into">
              <SelectInput value={target} onChange={(e) => setTarget(e.target.value as "new" | "current")}>
                <option value="current">This job — {currentJob.name}</option>
                <option value="new">New job{parsed.job.name ? ` — ${parsed.job.name}` : ""}</option>
              </SelectInput>
            </Field>
            <Field label="Apply unit type to all (optional)" hint="Copies the type's BoM + tasks onto every imported unit.">
              <SelectInput value={applyTypeId} onChange={(e) => setApplyTypeId(e.target.value)}>
                <option value="">— none (import attributes only) —</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
              </SelectInput>
            </Field>
          </div>

          {parsed.autodetected ? (
            <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
                  <tr>
                    <th className="px-2 py-2 w-6" />
                    <th className="px-2 py-2">Mark</th>
                    <th className="px-2 py-2">Cat</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">W×H</th>
                    <th className="px-2 py-2">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.units.map((u, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-2 py-1"><input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} /></td>
                      <td className="px-2 py-1 font-medium text-stone-700">{u.mark || "—"}</td>
                      <td className="px-2 py-1 text-stone-400">{u.category}</td>
                      <td className="px-2 py-1 text-stone-700">{u.description || u.typeCode || "—"}</td>
                      <td className="px-2 py-1">{u.qty ?? ""}</td>
                      <td className="px-2 py-1 text-stone-500">{u.width || "?"}×{u.height || "?"}</td>
                      <td className="px-2 py-1 text-stone-500">{u.location || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-700">
                Couldn&apos;t auto-detect a standard takeoff. Map the columns manually below.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Sheet">
                  <SelectInput value={manualSheet} onChange={(e) => { setManualSheet(e.target.value); setCols({}); }}>
                    {parsed.sheets.map((s) => <option key={s.name}>{s.name}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Header row">
                  <SelectInput value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
                    {(rawSheet?.rows || []).slice(0, 20).map((r, i) => (
                      <option key={i} value={i}>row {i + 1}: {r.slice(0, 4).filter(Boolean).join(" | ").slice(0, 40)}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Category">
                  <SelectInput value={manualCat} onChange={(e) => setManualCat(e.target.value)}>
                    {UNIT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {UNIT_FIELDS.map((field) => (
                  <Field key={field} label={field}>
                    <SelectInput
                      value={cols[field] ?? ""}
                      onChange={(e) => setCols((p) => ({ ...p, [field]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    >
                      <option value="">—</option>
                      {headerCells.map((h, i) => <option key={i} value={i}>{h || `col ${i + 1}`}</option>)}
                    </SelectInput>
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-sm text-stone-500">{manualUnits.length} unit{manualUnits.length === 1 ? "" : "s"} detected from mapping.</p>
            </div>
          )}
        </>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={doImport} disabled={!unitsToImport.length}>
          Import {unitsToImport.length || ""} unit{unitsToImport.length === 1 ? "" : "s"}
        </Button>
      </div>
    </Modal>
  );
}
