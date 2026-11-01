import { useEffect, useId, useState } from "react";

import type { Level } from "@/api/schemas";
import { RISK_META } from "@/lib/risk";
import type { InboxFilters as Filters } from "@/lib/useInboxFilters";

import { Icon } from "../Icon";
import styles from "./InboxFilters.module.css";

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
    <div className={styles.filters}>
      <div className={styles.search}>
        <label htmlFor={searchId} className="sr-only">
          Search emails
        </label>
        <Icon name="search" className={styles.searchIcon} />
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
          className={`input ${styles.searchInput}`}
          maxLength={200}
        />
      </div>
      <div role="group" aria-label="Filter by risk level" className={styles.levels}>
        {OPTIONS.map((opt) => {
          const active = filters.risk === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ risk: opt.value })}
              className={styles.level}
            >
              {opt.value ? (
                <span aria-hidden="true" className="dot" style={{ color: RISK_META[opt.value].cssVar }} />
              ) : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
