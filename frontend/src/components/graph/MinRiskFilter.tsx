import type { Level } from "@/api/schemas";

const OPTIONS: Array<{ value: Level | undefined; label: string }> = [
  { value: undefined, label: "All" },
  { value: "low", label: "Low+" },
  { value: "medium", label: "Medium+" },
  { value: "high", label: "High" },
];

export function MinRiskFilter({
  value,
  onChange,
}: {
  value: Level | undefined;
  onChange: (v: Level | undefined) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Minimum risk of source emails"
      className="inline-flex rounded-md border border-slate-300 bg-white p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
