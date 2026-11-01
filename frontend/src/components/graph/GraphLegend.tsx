import { ENTITY_META, ENTITY_TYPES } from "@/lib/entities";
import { RISK_LEVELS, RISK_META } from "@/lib/risk";

/** Open by default on desktop; collapsed on phones where it would cover the canvas. */
const startOpen = () => typeof window === "undefined" || !window.matchMedia?.("(max-width: 767px)").matches;

export function GraphLegend({ types }: { types: string[] }) {
  const shown = ENTITY_TYPES.filter((t) => types.includes(t));
  return (
    <details
      open={startOpen()}
      className="group rounded-lg border border-slate-200 bg-white/95 text-xs shadow-sm backdrop-blur"
    >
      <summary className="cursor-pointer select-none rounded-lg px-3 py-2 font-semibold text-slate-700">
        Legend
      </summary>
      <div className="space-y-3 px-3 pb-3">
        <div>
          <p className="mb-1 text-slate-500">Fill: entity type</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {shown.map((type) => (
              <li key={type} className="flex items-center gap-1.5 text-slate-700">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ENTITY_META[type].hex }}
                  aria-hidden="true"
                />
                {ENTITY_META[type].label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-slate-500">Ring: highest risk of its emails</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
            {RISK_LEVELS.map((level) => (
              <li key={level} className="flex items-center gap-1.5 text-slate-700">
                <span
                  className="h-2.5 w-2.5 rounded-full border-2 bg-white"
                  style={{ borderColor: RISK_META[level].hex }}
                  aria-hidden="true"
                />
                {level === "none" ? "No risk" : RISK_META[level].label}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-slate-500">Size: number of mentions</p>
      </div>
    </details>
  );
}
