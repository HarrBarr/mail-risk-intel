import { useHealth } from "@/api/hooks";
import { cx } from "@/lib/cx";

import styles from "./HealthBanner.module.css";

/** Shown only when it matters: the API is unreachable, or no LLM is available (rules mode). */
export function HealthBanner() {
  const health = useHealth();

  if (health.isError && !health.data) {
    return (
      <div role="alert" className={cx(styles.banner, styles.alarm)}>
        <div className={styles.inner}>
          <span className="dot" aria-hidden="true" />
          <span className={styles.text}>Can't reach the API. Data may be out of date.</span>
          <button type="button" className={styles.action} onClick={() => void health.refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (health.data?.mode !== "rules") return null;

  return (
    <div role="status" className={cx(styles.banner, styles.warn)}>
      <div className={styles.inner}>
        <span className="dot" aria-hidden="true" />
        <p className={styles.text}>
          <strong>No LLM reachable</strong> — results come from the rule-based fallback.
        </p>
      </div>
    </div>
  );
}
