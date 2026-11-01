import type { Level, Status } from "@/api/schemas";
import { cx } from "@/lib/cx";
import { RISK_META, RISK_RANK, STATUS_LABEL, isInFlight } from "@/lib/risk";

import { Icon } from "./Icon";
import styles from "./RiskBadge.module.css";
import { Spinner } from "./Spinner";

interface RiskBadgeProps {
  level: Level | null;
  /** When the email isn't done yet the badge shows a neutral processing/failed state instead. */
  status?: Status;
  size?: "sm" | "md";
  className?: string;
}

/** Three bars, filled up to the level: a shape cue so the level never relies on color alone. */
function Meter({ level }: { level: Level }) {
  const rank = RISK_RANK[level];
  return (
    <span aria-hidden="true" className={styles.meter}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cx(styles.bar, n <= rank && styles.barOn)}
          style={{ height: `${4 + n * 2}px` }}
        />
      ))}
    </span>
  );
}

export function RiskBadge({ level, status = "done", size = "sm", className }: RiskBadgeProps) {
  const base = cx(styles.badge, styles[size], className);

  if (status === "failed") {
    return (
      <span className={cx(base, styles.failed)} data-state="failed">
        <Icon name="alert" size={14} />
        Failed
      </span>
    );
  }

  if (isInFlight(status) || level === null) {
    return (
      <span className={cx(base, styles.neutral)} data-state="processing">
        {isInFlight(status) ? <Spinner /> : null}
        {isInFlight(status) ? STATUS_LABEL[status] : "Not assessed"}
      </span>
    );
  }

  const meta = RISK_META[level];
  return (
    <span
      className={cx(base, styles[level])}
      data-level={level}
      title={meta.description}
      aria-label={level === "none" ? "Risk: none" : `Risk: ${meta.label.toLowerCase()}`}
    >
      <Meter level={level} />
      <span aria-hidden="true">{level === "none" ? meta.label : `${meta.label} risk`}</span>
    </span>
  );
}
