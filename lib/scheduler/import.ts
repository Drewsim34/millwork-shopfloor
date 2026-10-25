// Excel importers for the production scheduler. Ported from the CRM.
//   • parseUnitTypesWorkbook — the Odoo-style master (bom / process steps / work
//     center sheets) → unit-type templates.
//   • parseTakeoffWorkbook — a Millwork Artisans takeoff (Specifications +
//     Windows / Int Doors sheets) → a job + its units. Falls back to returning
//     raw sheets for manual column mapping when nothing is auto-detected.

import * as XLSX from "xlsx";
import type { BomLine, TaskLine } from "./model";

/* ---------------------------------------------------------------- helpers */

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return isFinite(v) ? v : undefined;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : undefined;
}

const isYes = (v: unknown): boolean => /^(y|yes|true|1)$/i.test(str(v));

type Row = unknown[];
function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as Row[];
}

const rowHasText = (r: Row): boolean => r.some((c) => str(c) !== "");

/* ----------------------------------------------------- unit-type workbook */

export interface ParsedUnitType {
  code: string;
  name: string;
  category?: string;
  bom: BomLine[];
  tasks: TaskLine[];
}

export function parseUnitTypesWorkbook(buf: ArrayBuffer): ParsedUnitType[] {
  const wb = XLSX.read(buf, { type: "array" });
  const byCode: Record<string, ParsedUnitType> = {};
  const get = (code: string, name?: string): ParsedUnitType =>
    (byCode[code] ||= { code, name: name || code, bom: [], tasks: [] });

  // BoM sheet: ProductCode | ProductName | CompCode | CompName | Qty | Make/Buy | Comments
  const bomName = wb.SheetNames.find((n) => /bom|bill|material/i.test(n));
  if (bomName) {
    for (const r of sheetRows(wb, bomName)) {
      const code = str(r[0]);
      if (!code) continue;
      const joined = (str(r[0]) + str(r[1]) + str(r[2]) + str(r[3])).toLowerCase();
      if (/product\s*code|component|make.?buy|comp\s*name/.test(joined) && !str(r[4]).match(/^\d/)) continue; // header
      const compCode = str(r[2]);
      const compName = str(r[3]);
      if (!compName && !compCode) continue;
      get(code, str(r[1])).bom.push({
        code: compCode || undefined,
        name: compName || compCode,
        qty: num(r[4]),
        makeBuy: str(r[5]) || undefined,
      });
    }
  }

  // Process-steps sheet: Code | Name | Step | Process | WorkCenter | Mins | Skilled | Comments
  const procName = wb.SheetNames.find((n) => /process|step|routing|operation/i.test(n));
  if (procName) {
    for (const r of sheetRows(wb, procName)) {
      const code = str(r[0]);
      if (!code) continue;
      if (/product\s*code|^code$/i.test(code) || /work\s*cent/i.test(str(r[4]))) continue; // header
      const proc = str(r[3]);
      const wc = str(r[4]);
      if (!proc && !wc) continue;
      get(code, str(r[1])).tasks.push({
        step: num(r[2]),
        name: proc || wc,
        workCenter: wc,
        minutes: num(r[5]) || 0,
        skilled: isYes(r[6]),
      });
    }
  }

  Object.values(byCode).forEach((t) => t.tasks.sort((a, b) => (a.step || 0) - (b.step || 0)));
  return Object.values(byCode).filter((t) => t.bom.length || t.tasks.length);
}

/* -------------------------------------------------------- takeoff workbook */

export interface ParsedUnit {
  mark?: string;
  typeCode?: string;
  category?: string;
  location?: string;
  description?: string;
  material?: string;
  finish?: string;
  qty?: number;
  width?: number;
  height?: number;
  thickness?: number;
  jambDepth?: number;
}

export interface RawSheet {
  name: string;
  rows: string[][]; // first ~40 rows, stringified, for the manual mapper
}

export interface ParsedTakeoff {
  job: { jobNumber?: string; name?: string; address?: string; customer?: string };
  units: ParsedUnit[];
  sheets: RawSheet[]; // always provided, for the manual-mapping fallback
  autodetected: boolean;
}

// classify a header cell → unit field key
function classifyHeader(h: string): keyof ParsedUnit | "seq" | null {
  const s = h.toLowerCase();
  if (/(window|door|unit)\s*no|^mark$/.test(s)) return "mark";
  if (/^no\.?$|^item$|^#$/.test(s)) return "seq";
  if (/type/.test(s)) return "typeCode";
  if (/location/.test(s)) return "location";
  if (/descrip|desc\b/.test(s)) return "description";
  if (/material|species/.test(s)) return "material";
  if (/finish/.test(s)) return "finish";
  if (/qty|quantity|units/.test(s)) return "qty";
  if (/thick/.test(s)) return "thickness";
  if (/width/.test(s)) return "width";
  if (/height/.test(s)) return "height";
  if (/jamb/.test(s)) return "jambDepth";
  return null;
}

const STOP_ROW = /color\s*symbology|symbology|deleted unit|legend/i;

function parseSpecifications(wb: XLSX.WorkBook): ParsedTakeoff["job"] {
  const job: ParsedTakeoff["job"] = {};
  const specName = wb.SheetNames.find((n) => /spec/i.test(n));
  const rows = specName ? sheetRows(wb, specName) : [];
  const valueAfter = (r: Row): string => {
    for (let i = 1; i < r.length; i++) if (str(r[i])) return str(r[i]);
    return "";
  };
  for (const r of rows) {
    const label = str(r[0]).toLowerCase();
    if (!label) continue;
    if (/proposal/.test(label) && !job.jobNumber) job.jobNumber = valueAfter(r).replace(/^#/, "");
    else if (/job\s*name/.test(label) && !job.name) job.name = valueAfter(r);
    else if (/job\s*address|^address/.test(label) && !job.address) job.address = valueAfter(r);
    else if (/customer/.test(label) && !job.customer) job.customer = valueAfter(r);
  }
  return job;
}

export function parseTakeoffWorkbook(buf: ArrayBuffer): ParsedTakeoff {
  const wb = XLSX.read(buf, { type: "array" });
  const job = parseSpecifications(wb);
  const units: ParsedUnit[] = [];

  // job-name fallback from a Windows/Doors sheet header block (Project @ col 3)
  if (!job.name) {
    for (const n of wb.SheetNames) {
      const rows = sheetRows(wb, n);
      const r0 = rows[0];
      if (r0 && /project/i.test(str(r0[0]))) { job.name = str(r0[3]) || job.name; break; }
    }
  }

  const productSheets = wb.SheetNames.filter((n) => /window|door/i.test(n) && !/work\s*cent/i.test(n));
  for (const name of productSheets) {
    const rows = sheetRows(wb, name);
    // find header row: has a "qty" cell and a "type"/"width"/"description" cell
    let hIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const cells = rows[i].map((c) => str(c).toLowerCase());
      if (cells.some((c) => /qty|quantity/.test(c)) && cells.some((c) => /type|width|descrip/.test(c))) {
        hIdx = i;
        break;
      }
    }
    if (hIdx < 0) continue;

    const headers = rows[hIdx].map((c) => str(c));
    const colMap: Record<number, keyof ParsedUnit | "seq"> = {};
    headers.forEach((h, i) => {
      const k = classifyHeader(h);
      if (k) colMap[i] = k;
    });
    const category = /door/i.test(name) ? "Door" : "Window";
    let section = "";
    let lastLoc = ""; // location carried onto multi-leaf continuation rows

    for (let i = hIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!rowHasText(r)) continue;
      if (STOP_ROW.test(str(r[0]) + str(r[1]) + str(r[2]))) break;

      const u: ParsedUnit = { category };
      let hasField = false;
      for (const [idxStr, key] of Object.entries(colMap)) {
        const idx = Number(idxStr);
        const raw = r[idx];
        if (raw == null || raw === "") continue;
        if (key === "seq") continue;
        if (key === "qty" || key === "width" || key === "height" || key === "thickness" || key === "jambDepth") {
          const v = num(raw);
          if (v != null) { u[key] = v; hasField = true; }
        } else {
          u[key] = str(raw);
          hasField = true;
        }
      }

      // a row with only the first column filled = a section heading
      const onlyFirst = str(r[0]) && r.slice(1).every((c) => str(c) === "");
      if (onlyFirst && !hasField) { section = str(r[0]); lastLoc = ""; continue; }

      // keep rows that look like real units
      const isUnit = (u.qty != null && u.qty > 0) || (!!u.mark && (!!u.description || !!u.width || !!u.typeCode));
      if (!isUnit) continue;
      // continuation rows (e.g. extra leaves) inherit the previous unit's
      // location rather than the section heading
      if (u.location) lastLoc = u.location;
      else u.location = lastLoc || section || undefined;
      units.push(u);
    }
  }

  const sheets: RawSheet[] = wb.SheetNames.map((name) => ({
    name,
    rows: sheetRows(wb, name).slice(0, 40).map((r) => r.map((c) => str(c))),
  }));

  return { job, units, sheets, autodetected: units.length > 0 };
}

/* ------------------------------------------- generic mapped-sheet import */

export interface ColumnMapping {
  sheet: string;
  headerRow: number;
  category: string;
  cols: Partial<Record<keyof ParsedUnit | "seq", number>>;
}

// Build units from a user-supplied column mapping (the manual fallback).
export function unitsFromMapping(buf: ArrayBuffer, map: ColumnMapping): ParsedUnit[] {
  const wb = XLSX.read(buf, { type: "array" });
  const rows = sheetRows(wb, map.sheet);
  const out: ParsedUnit[] = [];
  for (let i = map.headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!rowHasText(r)) continue;
    if (STOP_ROW.test(str(r[0]) + str(r[1]))) break;
    const u: ParsedUnit = { category: map.category };
    let has = false;
    (Object.entries(map.cols) as [keyof ParsedUnit | "seq", number][]).forEach(([key, idx]) => {
      if (key === "seq" || idx == null) return;
      const raw = r[idx];
      if (raw == null || raw === "") return;
      if (key === "qty" || key === "width" || key === "height" || key === "thickness" || key === "jambDepth") {
        const v = num(raw);
        if (v != null) { u[key] = v; has = true; }
      } else {
        u[key] = str(raw);
        has = true;
      }
    });
    if (has) out.push(u);
  }
  return out;
}
