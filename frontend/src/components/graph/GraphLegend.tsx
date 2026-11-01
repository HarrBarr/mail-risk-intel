import type { CSSProperties } from "react";

import { ENTITY_META, ENTITY_TYPES } from "@/lib/entities";
import { RISK_LEVELS, RISK_META } from "@/lib/risk";

import styles from "./GraphLegend.module.css";

/** Open by default on desktop; collapsed on phones where it would cover the canvas. */
const startOpen = () => typeof window === "undefined" || !window.matchMedia?.("(max-width: 767px)").matches;

export function GraphLegend({ types }: { types: string[] }) {
  const shown = ENTITY_TYPES.filter((t) => types.includes(t));
  return (
    <details open={startOpen()} className={styles.legend}>
      <summary className={styles.summary}>Legend</summary>
      <div className={styles.body}>
        <div>
          <p className={styles.caption}>Fill · entity type</p>
          <ul className={styles.grid}>
            {shown.map((type) => (
              <li key={type} className={styles.item}>
                <span
                  className={styles.fill}
                  style={{ "--tone": ENTITY_META[type].hex } as CSSProperties}
                  aria-hidden="true"
                />
                {ENTITY_META[type].label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={styles.caption}>Ring · highest risk of its emails</p>
          <ul className={styles.grid}>
            {RISK_LEVELS.map((level) => (
              <li key={level} className={styles.item}>
                <span
                  className={styles.ring}
                  style={{ "--tone": RISK_META[level].hex } as CSSProperties}
                  aria-hidden="true"
                />
                {level === "none" ? "No risk" : RISK_META[level].label}
              </li>
            ))}
          </ul>
        </div>
        <p className={styles.caption}>Size · number of mentions</p>
      </div>
    </details>
  );
}
