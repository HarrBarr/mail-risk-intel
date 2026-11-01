import { useEffect, useId, useState } from "react";

import type { Level } from "@/api/schemas";
import { RISK_META } from "@/lib/risk";
import type { InboxFilters as Filters } from "@/lib/useInboxFilters";

import { Icon } from "../Icon";

const OPTIONS: Array<{ value: Level | undefined; label: string }> = [
  { value: undefined, label: "All" },
  { value: "high", label: RISK_META.high.label },
  { value: "medium", label: RISK_META.medium.label },
  { value: "low", label: RISK_META.low.label },
  { value: "none", label: "None" },
];

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

export function InboxFilters({ filters, onChange }: Props) {
  const searchId = useId();
  const [q, setQ] = useState(filters.q);

  // Keep the box in sync if the URL changes underneath us (back/forward).
  useEffect(() => setQ(filters.q), [filters.q]);

  // Debounce typing into the URL (and therefore the query).
  useEffect(() => {
    if (q === filters.q) return;
    const t = window.setTimeout(() => onChange({ q: q.trim() ? q : "" }), 300);
    return () => window.clearTimeout(t);
  }, [q, filters.q, onChange]);

  return (
    <div className="space-y-3 border-b border-slate-200 px-4 py-3">
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search emails
        </label>
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          id={searchId}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q) {
              e.preventDefault();
              setQ("");
            }
          }}
          placeholder="Search sender, subject, content…"
          className="input pl-9"
          maxLength={200}
        />
      </div>
      <div role="group" aria-label="Filter by risk level" className="flex flex-wrap gap-1.5">
        {OPTIONS.map((opt) => {
          const active = filters.risk === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ risk: opt.value })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {opt.value ? (
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${RISK_META[opt.value].dot}`} />
              ) : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
