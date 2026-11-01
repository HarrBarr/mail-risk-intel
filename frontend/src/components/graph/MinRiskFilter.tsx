import type { Level } from "@/api/schemas";

import styles from "./MinRiskFilter.module.css";

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
    <div role="group" aria-label="Minimum risk of source emails" className={styles.group}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={styles.option}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
