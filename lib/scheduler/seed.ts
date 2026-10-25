// Millwork Artisans — production-scheduler reference data.
// Mirrors millwork-crm/lib/scheduler/seed.ts. Static shop reference data:
// work centers (fine-grained stations the engine schedules against), the
// operator roster with their skills, and the Door A sample build. The 10
// shop-floor stations in lib/stations.ts roll these work centers up.

export interface WorkCenter {
  id: string;
  name: string;
  capacity: number;
  color: string;
}

export interface Operator {
  id: string;
  name: string;
  active: boolean;
  skills: string[]; // work-center ids this operator can run
}

export interface Operation {
  id: string;
  name: string;
  workCenter: string;
  minutes: number;
}

export interface ManufacturingOrder {
  id: string;
  code: string;
  product: string;
  units: number;
  priority: number; // 1 = highest
  due: string; // YYYY-MM-DD
  childMOs: string[]; // sub-assemblies that must finish before this MO's own ops
  operations: Operation[];
}

export interface BomNode {
  name: string;
  code?: string;
  mo?: string;
  children?: BomNode[];
}

export const WORK_CENTERS: WorkCenter[] = [
  { id: "rip_saw", name: "Rip Saw", capacity: 1, color: "#f8c9c4" },
  { id: "rough_mill", name: "Rough Mill", capacity: 1, color: "#e8d4b0" },
  { id: "planer", name: "Planer", capacity: 1, color: "#cdb3e0" },
  { id: "jointer", name: "Jointer", capacity: 1, color: "#b9c6e6" },
  { id: "upcut_saw", name: "Upcut Saw", capacity: 1, color: "#f6e08a" },
  { id: "glue_bench", name: "Glue Bench", capacity: 2, color: "#f3c08a" },
  { id: "clamp_rack", name: "Clamp Rack", capacity: 4, color: "#cfe2c4" },
  { id: "cnc_accord", name: "CNC – Accord 25", capacity: 1, color: "#9fd6ce" },
  { id: "sander_dmc", name: "Sander – DMC 70", capacity: 1, color: "#f5b8d0" },
  { id: "assembly_table", name: "Assembly Table", capacity: 2, color: "#aac0e6" },
  { id: "glazing_station", name: "Glazing Station", capacity: 2, color: "#cde0c4" },
  { id: "frame_station", name: "Frame Station", capacity: 1, color: "#d9c2a0" },
  { id: "final_assembly", name: "Final Assembly / Shipping", capacity: 1, color: "#c4d8e0" },
  { id: "paint_shop", name: "Paint Shop", capacity: 1, color: "#bfe0bf" },
  { id: "muntin_cell", name: "Muntin Cell", capacity: 1, color: "#e0d0bf" },
  { id: "weld_booth", name: "Weld Booth", capacity: 1, color: "#e6b89f" },
  { id: "laser", name: "Fiber Laser Cutter", capacity: 1, color: "#bcd0e6" },
  { id: "manual_bench", name: "Manual Bench", capacity: 1, color: "#dcdcdc" },
  { id: "manual_station", name: "Manual Station", capacity: 1, color: "#dcdcdc" },
  { id: "qa", name: "QA / Inspection", capacity: 1, color: "#cfe0d0" },
  { id: "packing", name: "Packing Station", capacity: 1, color: "#e0dcc0" },
];

// Operators with the work centers they can run (skills) + base availability.
export const OPERATORS: Operator[] = [
  { id: "rusty", name: "Rusty", active: true, skills: ["rip_saw", "upcut_saw", "assembly_table", "frame_station", "rough_mill"] },
  { id: "cody", name: "Cody", active: true, skills: ["glazing_station", "assembly_table", "final_assembly"] },
  { id: "andrew", name: "Andrew", active: true, skills: ["glazing_station", "packing", "sander_dmc"] },
  { id: "joe", name: "Joe", active: true, skills: ["paint_shop"] },
  { id: "cole", name: "cole", active: true, skills: ["cnc_accord", "rough_mill", "rip_saw", "planer", "muntin_cell"] },
  { id: "dom", name: "Dom", active: true, skills: ["cnc_accord", "jointer"] },
  { id: "bryan", name: "Bryan", active: true, skills: ["glue_bench", "assembly_table", "jointer", "clamp_rack"] },
  { id: "thomas", name: "Thomas", active: true, skills: ["glue_bench", "clamp_rack", "assembly_table"] },
  { id: "beverly", name: "Beverly", active: true, skills: ["weld_booth", "frame_station"] },
  { id: "mike", name: "mike", active: true, skills: ["sander_dmc", "frame_station", "weld_booth"] },
  { id: "corbin", name: "Corbin", active: true, skills: ["glue_bench", "rip_saw", "planer", "clamp_rack"] },
  { id: "steve", name: "Steve Varner", active: true, skills: ["laser", "manual_bench", "manual_station", "qa", "packing"] },
  { id: "drew", name: "drew simmons", active: false, skills: WORK_CENTERS.map((w) => w.id) }, // supervisor / floats
];

let _op = 0;
const op = (name: string, workCenter: string, minutes: number): Operation => ({
  id: "op" + ++_op,
  name,
  workCenter,
  minutes,
});

// Manufacturing Orders (mirror the Odoo cards). childMOs = sub-assemblies that
// must be fully complete before this MO's own operations may start.
export const MANUFACTURING_ORDERS: ManufacturingOrder[] = [
  {
    id: "WH/MO/00022", code: "SUB-STILESTAVE-001", product: "Stile Staves", units: 1,
    priority: 3, due: "2026-06-16", childMOs: [],
    operations: [
      op("Rip Lumber to Stave Size", "rip_saw", 45),
      op("Planing – Staves", "planer", 30),
      op("Glue-Up – Stiles", "glue_bench", 45),
      op("Clamp and Cure", "clamp_rack", 120),
    ],
  },
  {
    id: "WH/MO/00023", code: "SUB-PANELCORE-001", product: "Panel Core", units: 1,
    priority: 3, due: "2026-06-16", childMOs: [],
    operations: [
      op("Rip Core Lumber", "rip_saw", 60),
      op("Join Panel Planks", "jointer", 60),
      op("Planing – Panel Planks", "planer", 60),
      op("Glue-Up Panel Core", "glue_bench", 60),
      op("CNC Machining – Panel", "cnc_accord", 60),
    ],
  },
  {
    id: "WH/MO/00024", code: "FR-005", product: "Stainless Mounting Plate", units: 1,
    priority: 3, due: "2026-06-16", childMOs: [],
    operations: [
      op("Laser Cut Plate", "laser", 10),
      op("Counter Sink", "manual_bench", 5),
      op("Deburr & Edge Finish", "manual_station", 20),
      op("Quality Check & Marking", "qa", 10),
    ],
  },
  {
    id: "WH/MO/00020", code: "SUB-GS-001", product: "Glazed Sash Unit", units: 1,
    priority: 2, due: "2026-06-17", childMOs: ["WH/MO/00022", "WH/MO/00023"],
    operations: [
      op("Cut to Length – Stiles/Panels", "upcut_saw", 60),
      op("Sanding – Panel Surface", "sander_dmc", 10),
      op("Apply Glazing Tape", "glazing_station", 10),
      op("Dry Fit Glass", "glazing_station", 5),
      op("Apply Dow 995 Sealant", "glazing_station", 10),
      op("Insert Glass + SDLs", "glazing_station", 5),
      op("Brad Nailing Internal", "glazing_station", 5),
      op("Apply Exterior Bead", "glazing_station", 10),
      op("Apply Interior Bead", "glazing_station", 10),
      op("Clean and QC", "glazing_station", 5),
    ],
  },
  {
    id: "WH/MO/00021", code: "SUB-FRAME-001", product: "Frame Assembly with Hardware", units: 1,
    priority: 2, due: "2026-06-17", childMOs: ["WH/MO/00024"],
    operations: [
      op("Rip Frame Planks", "rip_saw", 60),
      op("CNC Machining – Frame", "cnc_accord", 60),
      op("Sanding – Frame Surface", "sander_dmc", 10),
      op("Install Brass Threshold", "frame_station", 10),
      op("Mount Hinges", "frame_station", 10),
      op("Install Strike Plate", "frame_station", 5),
      op("Install Shoot Bolt Plate", "frame_station", 5),
    ],
  },
  {
    id: "WH/MO/00019", code: "D-A001", product: "Door A", units: 1,
    priority: 1, due: "2026-06-18", childMOs: ["WH/MO/00020", "WH/MO/00021"],
    operations: [
      op("Assembly – Frame", "assembly_table", 60),
      op("Paint – Primer", "paint_shop", 60),
      op("Wrap Frame & Apply Label", "packing", 10),
    ],
  },
];

// BoM tree (for the dependency view).
export const BOM: BomNode = {
  name: "Door A (Finished Door Unit)", code: "D-A001", children: [
    { name: "Glazed Sash Unit", code: "SUB-GS-001", mo: "WH/MO/00020", children: [
      { name: "Stile Staves", code: "SUB-STILESTAVE-001", mo: "WH/MO/00022", children: [
        { name: "Lumber Blanks (buy)" }, { name: "Adhesive/Glue (buy)" },
      ] },
      { name: "Panel Core", code: "SUB-PANELCORE-001", mo: "WH/MO/00023", children: [
        { name: "Hardwood Planks (buy)" }, { name: "Wood Glue (buy)" },
      ] },
      { name: "Glass Panel (buy)" }, { name: "SDL Grid – Internal" }, { name: "SDL Grid – External" },
      { name: "Glazing Tape + Sealants (Dow 995 / Novagard)" }, { name: "23-ga Brad Nails" }, { name: "Cleaning Cloth" },
    ] },
    { name: "Frame Assembly with Hardware", code: "SUB-FRAME-001", mo: "WH/MO/00021", children: [
      { name: "Stainless Mounting Plate", code: "FR-005", mo: "WH/MO/00024", children: [
        { name: "Stainless Steel Sheet (buy)" }, { name: "Deburring Materials" },
      ] },
      { name: "Brass Threshold" }, { name: "Hinges x3" }, { name: "Strike Plate" },
      { name: "Shoot Bolt Plate" }, { name: "Weather Seal SPV-12" }, { name: "Packaging Materials" },
    ] },
  ],
};
