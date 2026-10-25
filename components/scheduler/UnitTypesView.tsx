"use client";

// Unit-type catalog: reusable door/window templates with a default BoM + task
// routing. Create/edit by hand or import from the bom / process-steps workbook.
// Ported from the CRM Production Scheduler.

import { useState } from "react";
import { id } from "@instantdb/react";
import { idb } from "@/lib/instant";
import { Button, Card, Badge, Modal, Field, TextInput, SelectInput, EmptyState } from "@/components/ui";
import { BomEditor, TasksEditor } from "@/components/scheduler/editors";
import {
  parseLines,
  totalMinutes,
  UNIT_CATEGORIES,
  type UnitType,
  type BomLine,
  type TaskLine,
} from "@/lib/scheduler/model";
import { parseUnitTypesWorkbook, type ParsedUnitType } from "@/lib/scheduler/import";
import { STARTER_UNIT_TYPES } from "@/lib/unitTypeLibrary";

type TypeRecord = {
  id: string;
  code: string;
  name: string;
  category?: string;
  material?: string;
  bom?: string;
  tasks?: string;
};

function toType(r: TypeRecord): UnitType {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    material: r.material,
    bom: parseLines<BomLine>(r.bom),
    tasks: parseLines<TaskLine>(r.tasks),
  };
}

export function UnitTypesView() {
  const { data } = idb.useQuery({ mfgUnitTypes: {} });
  const types = ((data?.mfgUnitTypes ?? []) as TypeRecord[]).map(toType).sort((a, b) => a.code.localeCompare(b.code));

  const [editing, setEditing] = useState<UnitType | null>(null);
  const [importing, setImporting] = useState(false);

  function loadLibrary() {
    const now = new Date().toISOString();
    const have = new Set(types.map((t) => t.code));
    const missing = STARTER_UNIT_TYPES.filter((s) => !have.has(s.code));
    if (!missing.length) { alert("Standard library already loaded — all template codes exist."); return; }
    idb.transact(
      missing.map((s) =>
        idb.tx.mfgUnitTypes[id()].update({
          code: s.code,
          name: s.name,
          category: s.category,
          material: s.material ?? null,
          bom: JSON.stringify(s.bom ?? []),
          tasks: JSON.stringify(s.tasks),
          createdAt: now,
          updatedAt: now,
        })
      )
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">
          {types.length} unit type{types.length === 1 ? "" : "s"} — templates copied onto units when you add them to a job.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" onClick={loadLibrary}>✨ Load standard library</Button>
          <Button variant="subtle" onClick={() => setImporting(true)}>⬆ Import unit types (Excel)</Button>
          <Button onClick={() => setEditing({ id: "", code: "", name: "", category: "Door", bom: [], tasks: [] })}>
            + New unit type
          </Button>
        </div>
      </div>

      {types.length === 0 ? (
        <EmptyState
          title="No unit types yet"
          hint="Import the bom / process-steps workbook, or create a type by hand. Each type carries a default bill-of-materials and task routing."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <Card key={t.id} className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-stone-400">{t.code}</div>
                  <div className="font-semibold text-stone-800">{t.name}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {t.category && <Badge color="#3a5bd9">{t.category}</Badge>}
                  {t.material && <Badge color={t.material === "Metal" ? "#5b6b7a" : t.material === "Both" ? "#2950db" : "#9a6b3f"}>{t.material}</Badge>}
                </div>
              </div>
              <div className="mt-2 flex gap-3 text-xs text-stone-500">
                <span>{t.bom.length} BoM</span>
                <span>{t.tasks.length} tasks</span>
                <span>{totalMinutes(t.tasks)} min</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="subtle" className="px-2.5 py-1 text-xs" onClick={() => setEditing(t)}>Edit</Button>
                <Button
                  variant="danger"
                  className="px-2.5 py-1 text-xs"
                  onClick={() => {
                    if (confirm(`Delete unit type ${t.code}?`)) idb.transact(idb.tx.mfgUnitTypes[t.id].delete());
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <TypeEditor type={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportTypes existing={types} onClose={() => setImporting(false)} />}
    </div>
  );
}

/* ----------------------------------------------------------- type editor */

function TypeEditor({ type, onClose }: { type: UnitType; onClose: () => void }) {
  const [code, setCode] = useState(type.code);
  const [name, setName] = useState(type.name);
  const [category, setCategory] = useState(type.category || "Door");
  const [bom, setBom] = useState<BomLine[]>(type.bom);
  const [tasks, setTasks] = useState<TaskLine[]>(type.tasks);
  const [wood, setWood] = useState(/wood|both/i.test(type.material || ""));
  const [metal, setMetal] = useState(/metal|both/i.test(type.material || ""));
  const material = wood && metal ? "Both" : wood ? "Wood" : metal ? "Metal" : undefined;

  function save() {
    if (!code.trim() || !name.trim()) {
      alert("Code and name are required.");
      return;
    }
    const now = new Date().toISOString();
    const recId = type.id || id();
    idb.transact(
      idb.tx.mfgUnitTypes[recId].update({
        code: code.trim(),
        name: name.trim(),
        category,
        material: material ?? null,
        bom: JSON.stringify(bom),
        tasks: JSON.stringify(tasks),
        updatedAt: now,
        ...(type.id ? {} : { createdAt: now }),
      })
    );
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={type.id ? `Edit ${type.code}` : "New unit type"} wide>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Code"><TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="D-A001" /></Field>
        <Field label="Name" className="col-span-2"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Door A" /></Field>
        <Field label="Category">
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            {UNIT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </SelectInput>
        </Field>
        <Field label="Material (sorts the production line)" className="col-span-2">
          <div className="flex items-center gap-5 pt-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={wood} onChange={(e) => setWood(e.target.checked)} /> Wood
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={metal} onChange={(e) => setMetal(e.target.checked)} /> Metal
            </label>
            <span className="text-xs text-stone-400">{material ? `→ ${material} line` : "no line set"}</span>
          </div>
        </Field>
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
        <Button onClick={save}>Save unit type</Button>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------- import modal */

function ImportTypes({ existing, onClose }: { existing: UnitType[]; onClose: () => void }) {
  const [parsed, setParsed] = useState<ParsedUnitType[] | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setErr(null);
    try {
      const buf = await f.arrayBuffer();
      const types = parseUnitTypesWorkbook(buf);
      if (!types.length) {
        setErr("No unit types found. Expected a workbook with 'bom' and 'process steps' sheets.");
        setParsed(null);
        return;
      }
      setParsed(types);
      setPicked(Object.fromEntries(types.map((t) => [t.code, true])));
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not read that file.");
    }
  }

  function doImport() {
    if (!parsed) return;
    const now = new Date().toISOString();
    const byCode = Object.fromEntries(existing.map((t) => [t.code, t.id]));
    const txns = parsed
      .filter((t) => picked[t.code])
      .map((t) => {
        const recId = byCode[t.code] || id();
        return idb.tx.mfgUnitTypes[recId].update({
          code: t.code,
          name: t.name,
          category: t.category,
          bom: JSON.stringify(t.bom),
          tasks: JSON.stringify(t.tasks),
          updatedAt: now,
          ...(byCode[t.code] ? {} : { createdAt: now }),
        });
      });
    if (txns.length) idb.transact(txns);
    onClose();
  }

  const count = parsed ? parsed.filter((t) => picked[t.code]).length : 0;

  return (
    <Modal open onClose={onClose} title="Import unit types" wide>
      <p className="mb-3 text-sm text-stone-500">
        Select the manufacturing-setup workbook (sheets <code>bom</code>, <code>process steps</code>). Existing types with
        the same code are updated.
      </p>
      <input
        type="file"
        accept=".xlsx,.xlsm,.xls"
        onChange={onFile}
        className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-walnut-600 file:px-3 file:py-2 file:text-white"
      />
      {fileName && <p className="mt-1 text-xs text-stone-400">{fileName}</p>}
      {err && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>}

      {parsed && (
        <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-stone-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-400">
              <tr>
                <th className="px-3 py-2 w-8" />
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">BoM</th>
                <th className="px-3 py-2">Tasks</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map((t) => (
                <tr key={t.code} className="border-t border-stone-100">
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={!!picked[t.code]} onChange={(e) => setPicked((p) => ({ ...p, [t.code]: e.target.checked }))} />
                  </td>
                  <td className="px-3 py-1.5 text-stone-500">{t.code}</td>
                  <td className="px-3 py-1.5 font-medium text-stone-700">{t.name}</td>
                  <td className="px-3 py-1.5">{t.bom.length}</td>
                  <td className="px-3 py-1.5">{t.tasks.length}</td>
                  <td className="px-3 py-1.5">
                    {existing.some((e) => e.code === t.code) ? (
                      <span className="text-amber-600">updates existing</span>
                    ) : (
                      <span className="text-green-600">new</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={doImport} disabled={!count}>Import {count || ""} type{count === 1 ? "" : "s"}</Button>
      </div>
    </Modal>
  );
}
