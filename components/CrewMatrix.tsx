"use client";

// Employee ↔ station capability matrix. Rows are the shop's operators (from the
// scheduler roster), columns are the 10 production-floor stations. A filled cell
// means that operator is cross-trained to run that station. The active toggle
// feeds straight into the auto-schedule (inactive operators aren't assigned).

import { STATIONS, stationsForOperator, staffingForStation } from "@/lib/stations";
import { type Operator } from "@/lib/scheduler/seed";
import { Card, cx } from "@/components/ui";

const AV_COLORS = ["#3a5bd9", "#017e84", "#b5485f", "#2d6cb0", "#8a6d3b", "#3b8a52", "#9c4f8a", "#a06b2d", "#4f6f8a", "#7a5ba0"];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}

export function CrewMatrix({
  operators,
  onToggle,
  onDelete,
}: {
  operators: Operator[];
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* staffing / bus-factor summary per station */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STATIONS.map((st) => {
          const crew = staffingForStation(st.id, operators).filter((o) => o.active);
          const thin = st.kind === "shop" && crew.length <= 1;
          return (
            <Card key={st.id} className={cx("p-3", thin && "ring-1 ring-amber-300")}>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: st.color }} />
                <span className="text-xs font-semibold text-stone-700">{st.seq}. {st.name}</span>
              </div>
              <div className={cx("mt-1 text-sm font-semibold", thin ? "text-amber-600" : "text-stone-600")}>
                {st.kind === "office" ? "Office staffed" : `${crew.length} cross-trained`}
              </div>
              {thin && <div className="text-[11px] text-amber-600">Single point of failure</div>}
            </Card>
          );
        })}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                Employee
              </th>
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Status</th>
              {STATIONS.map((st) => (
                <th key={st.id} className="px-1.5 py-2 text-center align-bottom">
                  <div className="mx-auto flex h-20 w-7 items-end justify-center">
                    <span className="whitespace-nowrap text-xs font-medium text-stone-500 [writing-mode:vertical-rl] rotate-180">
                      {st.seq}. {st.name}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-500"># Stations</th>
              {onDelete && <th className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {operators.map((o) => {
              const caps = new Set(stationsForOperator(o));
              return (
                <tr key={o.id} className={cx("border-b border-stone-50 last:border-0", !o.active && "opacity-50")}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: avatarColor(o.name) }}>
                        {o.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="font-medium capitalize text-stone-700">{o.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => onToggle(o.id)}
                      className={cx(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        o.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      )}
                      title="Toggle active (feeds the auto-schedule)"
                    >
                      {o.active ? "● Active" : "○ Off"}
                    </button>
                  </td>
                  {STATIONS.map((st) => {
                    const can = caps.has(st.id);
                    return (
                      <td key={st.id} className="px-1.5 py-2 text-center">
                        {can ? (
                          <span className="mx-auto block h-4 w-4 rounded-sm" style={{ background: st.color }} title={`${o.name} can run ${st.name}`} />
                        ) : (
                          <span className="mx-auto block h-4 w-4 rounded-sm bg-stone-100" />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-semibold text-stone-600">{caps.size}</td>
                  {onDelete && (
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => { if (confirm(`Remove ${o.name} from the roster?`)) onDelete(o.id); }}
                        className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                        title="Remove employee"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-stone-400">
        Engineering &amp; Programming are office stations staffed outside the floor roster, so they show no cross-trained operators here.
        Capabilities are derived from each operator&apos;s work-center skills in the shared scheduler data — edit them there and both apps update.
      </p>
    </div>
  );
}
