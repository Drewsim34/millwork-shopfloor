// Standard unit-type template library — common custom window & door types with a
// pre-stored task routing across the shop's stations. Loaded into the editable
// mfgUnitTypes catalog ("Load standard library" on the Unit Types tab) and then
// adjusted per shop. Work-center names are chosen so the scheduler's mapper
// resolves each task to the right station.

import { type TaskLine, type BomLine } from "./scheduler/model";

export interface StarterType {
  code: string;
  name: string;
  category: string; // Window | Door | Other
  material?: string; // Wood | Metal | Both — drives line sorting
  bom?: BomLine[];
  tasks: TaskLine[];
}

const t = (step: number, name: string, workCenter: string, minutes: number, skilled = false): TaskLine => ({
  step,
  name,
  workCenter,
  minutes,
  skilled,
});

const b = (name: string, makeBuy: "Make" | "Buy", code?: string, qty?: number): BomLine => ({ name, makeBuy, code, qty });

// Shared pre-production steps (office — tracked, not auto-scheduled).
const eng = (s: number) => t(s, "Shop & production drawings", "Engineering", 60);
const prog = (s: number) => t(s + 1, "Output CNC program", "Programming", 20);

export const STARTER_UNIT_TYPES: StarterType[] = [
  {
    code: "WIN-CASE", name: "Casement Window", category: "Window", material: "Wood",
    tasks: [
      eng(1), prog(1),
      t(3, "Rip stiles & rails", "Rip Saw", 30),
      t(4, "Plane & dimension", "Planer", 20),
      t(5, "Cut to length", "Upcut Saw", 15),
      t(6, "CNC cope & stick", "CNC", 40, true),
      t(7, "Glue-up sash", "Glue Bench", 25),
      t(8, "Clamp & cure", "Clamp Rack", 90),
      t(9, "Assemble sash & frame", "Assembly Table", 45, true),
      t(10, "Build & fit muntin grid", "Muntin Cell", 30),
      t(11, "Sand", "Sander", 20),
      t(12, "Prime & finish coat", "Paint Shop", 60),
      t(13, "Glaze — tape, sealant, set glass, bead", "Glazing Station", 40, true),
      t(14, "Hardware, QA, wrap & ship", "Final Assembly", 30),
    ],
  },
  {
    code: "WIN-DH", name: "Double Hung Window", category: "Window", material: "Wood",
    tasks: [
      eng(1), prog(1),
      t(3, "Rip stiles & rails (2 sash)", "Rip Saw", 45),
      t(4, "Plane & dimension", "Planer", 25),
      t(5, "Cut to length", "Upcut Saw", 20),
      t(6, "CNC cope & stick", "CNC", 55, true),
      t(7, "Glue-up sashes", "Glue Bench", 35),
      t(8, "Clamp & cure", "Clamp Rack", 90),
      t(9, "Assemble sashes, frame & balances", "Assembly Table", 70, true),
      t(10, "Build & fit muntin grids", "Muntin Cell", 40),
      t(11, "Sand", "Sander", 25),
      t(12, "Prime & finish coat", "Paint Shop", 70),
      t(13, "Glaze both sashes", "Glazing Station", 55, true),
      t(14, "Hardware, QA, wrap & ship", "Final Assembly", 35),
    ],
  },
  {
    code: "WIN-FIXED", name: "Fixed Window", category: "Window", material: "Wood",
    tasks: [
      eng(1), prog(1),
      t(3, "Rip frame stock", "Rip Saw", 20),
      t(4, "Plane & dimension", "Planer", 15),
      t(5, "Cut to length", "Upcut Saw", 10),
      t(6, "CNC profile & joinery", "CNC", 25, true),
      t(7, "Assemble frame", "Assembly Table", 30),
      t(8, "Sand", "Sander", 15),
      t(9, "Prime & finish coat", "Paint Shop", 45),
      t(10, "Glaze — set glass & bead", "Glazing Station", 30, true),
      t(11, "QA, wrap & ship", "Final Assembly", 20),
    ],
  },
  {
    code: "WIN-AWNING", name: "Awning Window", category: "Window", material: "Wood",
    tasks: [
      eng(1), prog(1),
      t(3, "Rip stiles & rails", "Rip Saw", 28),
      t(4, "Plane & dimension", "Planer", 18),
      t(5, "Cut to length", "Upcut Saw", 12),
      t(6, "CNC cope & stick", "CNC", 38, true),
      t(7, "Glue-up sash", "Glue Bench", 22),
      t(8, "Clamp & cure", "Clamp Rack", 90),
      t(9, "Assemble sash & frame", "Assembly Table", 42, true),
      t(10, "Sand", "Sander", 18),
      t(11, "Prime & finish coat", "Paint Shop", 55),
      t(12, "Glaze", "Glazing Station", 38, true),
      t(13, "Hardware, QA, wrap & ship", "Final Assembly", 28),
    ],
  },
  {
    code: "DOOR-ENTRY", name: "Entry Door", category: "Door", material: "Wood",
    tasks: [
      eng(1), prog(1),
      t(3, "Rip stiles, rails & staves", "Rip Saw", 50),
      t(4, "Rough mill", "Rough Mill", 30),
      t(5, "Plane & dimension", "Planer", 30),
      t(6, "Glue-up panels & stiles", "Glue Bench", 45),
      t(7, "Clamp & cure", "Clamp Rack", 120),
      t(8, "CNC machine door & frame", "CNC", 60, true),
      t(9, "Assemble door & frame", "Assembly Table", 60, true),
      t(10, "Sand", "Sander", 30),
      t(11, "Prime & finish coat", "Paint Shop", 80),
      t(12, "Glaze lite (if glazed)", "Glazing Station", 30),
      t(13, "Hang, install hardware, QA, wrap", "Final Assembly", 50, true),
    ],
  },
  {
    code: "SIDELITE", name: "Sidelite", category: "Door", material: "Wood",
    tasks: [
      eng(1), prog(1),
      t(3, "Rip frame & muntin stock", "Rip Saw", 25),
      t(4, "Plane & dimension", "Planer", 18),
      t(5, "CNC profile & joinery", "CNC", 30, true),
      t(6, "Glue-up", "Glue Bench", 20),
      t(7, "Clamp & cure", "Clamp Rack", 60),
      t(8, "Assemble frame", "Assembly Table", 30),
      t(9, "Build & fit muntin grid", "Muntin Cell", 25),
      t(10, "Sand", "Sander", 15),
      t(11, "Prime & finish coat", "Paint Shop", 50),
      t(12, "Glaze", "Glazing Station", 32, true),
      t(13, "QA, wrap & ship", "Final Assembly", 20),
    ],
  },
  {
    code: "TRANSOM", name: "Transom", category: "Window", material: "Wood",
    tasks: [
      eng(1), prog(1),
      t(3, "Rip frame stock", "Rip Saw", 15),
      t(4, "CNC profile & joinery", "CNC", 20, true),
      t(5, "Assemble frame", "Assembly Table", 20),
      t(6, "Sand", "Sander", 10),
      t(7, "Prime & finish coat", "Paint Shop", 30),
      t(8, "Glaze", "Glazing Station", 22, true),
      t(9, "QA, wrap & ship", "Final Assembly", 15),
    ],
  },
  {
    // Full worked example built from the Door A BoM + SOP routing. Flattens the
    // sub-assemblies (stile staves, panel core, stainless plate → glazed sash +
    // frame → finished door) into one dependency-ordered routing.
    code: "D-A001", name: "Door A (Finished Door Unit)", category: "Door", material: "Both",
    bom: [
      b("Glazed Sash Unit", "Make", "SUB-GS-001"),
      b("Stile Staves", "Make", "SUB-STILESTAVE-001"),
      b("Lumber Blanks", "Buy"),
      b("Adhesive / Glue", "Buy"),
      b("Panel Core", "Make", "SUB-PANELCORE-001"),
      b("Hardwood Planks", "Buy"),
      b("Wood Glue", "Buy"),
      b("Glass Panel", "Buy"),
      b("SDL Grid – Internal", "Make"),
      b("SDL Grid – External", "Make"),
      b("Glazing Tape + Sealants (Dow 995 / Novagard)", "Buy"),
      b("23-ga Brad Nails", "Buy"),
      b("Cleaning Cloth", "Buy"),
      b("Frame Assembly with Hardware", "Make", "SUB-FRAME-001"),
      b("Stainless Mounting Plate", "Make", "FR-005"),
      b("Stainless Steel Sheet", "Buy"),
      b("Deburring Materials", "Buy"),
      b("Brass Threshold", "Buy"),
      b("Hinges", "Buy", undefined, 3),
      b("Strike Plate", "Buy"),
      b("Shoot Bolt Plate", "Buy"),
      b("Weather Seal SPV-12", "Buy"),
      b("Packaging Materials", "Buy"),
    ],
    tasks: [
      eng(1), prog(1),
      // Stile Staves (SUB-STILESTAVE-001)
      t(3, "Rip Lumber to Stave Size", "Rip Saw", 45),
      t(4, "Planing – Staves", "Planer", 30),
      t(5, "Glue-Up – Stiles", "Glue Bench", 45),
      t(6, "Clamp and Cure", "Clamp Rack", 120),
      // Panel Core (SUB-PANELCORE-001)
      t(7, "Rip Core Lumber", "Rip Saw", 60),
      t(8, "Join Panel Planks", "Jointer", 60),
      t(9, "Planing – Panel Planks", "Planer", 60),
      t(10, "Glue-Up Panel Core", "Glue Bench", 60),
      t(11, "CNC Machining – Panel", "CNC", 60, true),
      // Stainless Mounting Plate (FR-005)
      t(12, "Laser Cut Plate", "Laser", 10, true),
      t(13, "Counter Sink", "Manual Bench", 5),
      t(14, "Deburr & Edge Finish", "Manual Station", 20),
      t(15, "Quality Check & Marking", "QA", 10),
      // Glazed Sash Unit (SUB-GS-001)
      t(16, "Cut to Length – Stiles/Panels", "Upcut Saw", 60),
      t(17, "Sanding – Panel Surface", "Sander", 10),
      t(18, "Apply Glazing Tape", "Glazing Station", 10),
      t(19, "Dry Fit Glass", "Glazing Station", 5),
      t(20, "Apply Dow 995 Sealant", "Glazing Station", 10),
      t(21, "Insert Glass + SDLs", "Glazing Station", 5),
      t(22, "Brad Nailing Internal", "Glazing Station", 5),
      t(23, "Apply Exterior Bead", "Glazing Station", 10),
      t(24, "Apply Interior Bead", "Glazing Station", 10),
      t(25, "Clean and QC", "Glazing Station", 5),
      // Frame Assembly with Hardware (SUB-FRAME-001)
      t(26, "Rip Frame Planks", "Rip Saw", 60),
      t(27, "CNC Machining – Frame", "CNC", 60, true),
      t(28, "Sanding – Frame Surface", "Sander", 10),
      t(29, "Install Brass Threshold", "Frame Station", 10),
      t(30, "Mount Hinges", "Frame Station", 10),
      t(31, "Install Strike Plate", "Frame Station", 5),
      t(32, "Install Shoot Bolt Plate", "Frame Station", 5),
      // Finished Door (D-A001)
      t(33, "Assembly – Frame", "Assembly Table", 60, true),
      t(34, "Paint – Primer", "Paint Shop", 60),
      t(35, "Wrap Frame & Apply Label", "Packing", 10),
    ],
  },
];
