# Millwork Shop Floor

Production-floor management for Millwork Artisans — custom small-batch windows &
doors. A standalone Next.js app (same stack as the CRM) that **draws its data
live from the CRM Production Scheduler** and presents it as a shop-floor board
organized around the shop's 10 production stations.

## How it connects to the CRM

The CRM Production Scheduler stores jobs and units in a shared **InstantDB**
database (`mfgJobs`, `mfgUnits`, `mfgUnitTypes`). This app connects to the **same
InstantDB app id** (public, baked into `lib/instant.ts`) and reads those entities
in real time — so a job entered in the CRM shows up on the floor board within
seconds, no import step. Door A ships as a built-in sample so the board is never
empty.

The scheduling engine (`lib/scheduler/engine.ts`), domain model
(`lib/scheduler/model.ts`), and shop reference data (`lib/scheduler/seed.ts`) are
copied verbatim from the CRM so both apps compute identical schedules. Keep them
in sync if either changes.

## Competitor patterns this draws from

- **Innergy** (woodworking ERP): per-station production flow + a bottleneck
  indicator for real-time workflow visibility.
- **Infor Windows & Doors**: BOM → routing → station sequence (mill, assembly,
  glazing, finishing).
- **JobBOSS²**: drag-ready planning board / whiteboard scheduler, finite
  work-center capacity.
- **Katana**: priority queue per work center and a shop-floor control view
  operators work from top-down.

## The 10 stations

Each station rolls up one or more fine-grained scheduler work centers
(`lib/stations.ts`):

| # | Station | What happens | Rolled-up work centers |
|---|---------|--------------|------------------------|
| 1 | Engineering | Shop drawings, production drawings, glass orders, hardware orders | *(office / pre-production)* |
| 2 | Programming | Output CNC files to the machines | *(office / pre-production)* |
| 3 | Mill / Blanking | Blank material for the machines | Rip Saw, Rough Mill, Planer, Jointer, Upcut Saw |
| 4 | CNC | Accord 25, Record, Crafter + laser plate | CNC – Accord 25, Fiber Laser |
| 5 | Gluing | Glue-ups, clamp & cure | Glue Bench, Clamp Rack |
| 6 | Assembly | Sash & frame assembly, sanding, welded steel sub-frames | Assembly Table, Frame Station, Weld Booth, Sander – DMC 70 |
| 7 | Grid Center | SDL / muntin grids | Muntin Cell |
| 8 | Paint | Prime, finish-coat, cure | Paint Shop |
| 9 | Glass | Glaze sash — tape, Dow 995, set glass + SDLs, bead, QC | Glazing Station |
| 10 | Final Assembly | Hang, hardware, deburr, QA, wrap & ship | Final Assembly / Shipping, Packing, QA, Manual Bench, Manual Station |

Engineering and Programming are pre-production office stations: they're shown and
status-tracked on the board, but the auto-schedule doesn't assign floor operators
to them.

## Views

- **Floor Board** — the 10 stations as lanes in flow order. Each lane shows its
  queued operations with the suggested operator (from the auto-schedule),
  estimated hours, crew count, and a bottleneck flag. Tap an operation card to
  advance its status: Queued → Active → Done. (Status is saved per terminal in
  the browser — see "Roadmap".)
- **Schedule** — the dependency-aware auto-schedule: operator load bars, the full
  operation timeline, and a plain-language rationale.
- **Jobs** — every job in the scheduler with its unit count and due date.
- **Crew** — the employee ↔ station capability matrix and per-station bus factor.

## Employee roster & capabilities

From the shared scheduler roster (`lib/scheduler/seed.ts`). Capabilities below are
the floor stations derived from each operator's work-center skills:

| Employee | Capable stations |
|----------|------------------|
| Rusty | Mill, Assembly |
| Cody | Glass, Assembly, Final Assembly |
| Andrew | Glass, Assembly, Final Assembly |
| Joe | Paint |
| Cole | CNC, Mill, Grid Center |
| Dom | CNC, Mill |
| Bryan | Gluing, Assembly, Mill |
| Thomas | Gluing, Assembly |
| Beverly | Assembly |
| Mike | Assembly |
| Corbin | Gluing, Mill |
| Steve Varner | CNC (laser), Final Assembly |
| Drew Simmons | All shop stations (supervisor / floats — inactive by default) |

> Engineering and Programming have no floor operators — assign office staff. To
> edit capabilities, change an operator's skills in `lib/scheduler/seed.ts` (and
> the matching CRM file); both apps pick it up.

## Run it

Node is installed at `C:\Program Files\nodejs` (not on PATH).

```bash
npm install
npm run dev
```

Then open http://localhost:3000. No login is needed — the scheduler namespaces
are read-open in InstantDB.

## Deploy

Same as the CRM: push to GitHub, import to Vercel. The only required config is
`NEXT_PUBLIC_INSTANT_APP_ID` if you ever move off the shared app id (otherwise the
baked-in default is used).

## Roadmap

- **Shared live status** — operation status (Active/Done) is currently saved per
  terminal (localStorage). Team-wide live status needs a new InstantDB entity
  (e.g. `mfgOpStatus`) on the shared database; it's additive but touches infra the
  CRM + mobile share, so it's a deliberate next step.
- Drag an operation card to reassign its station or operator.
- Barcode / tablet "claim & complete" for operators at each station.
