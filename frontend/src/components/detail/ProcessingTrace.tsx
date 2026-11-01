import type { CSSProperties } from "react";

import type { Step } from "@/api/schemas";
import { capitalize, formatLatency } from "@/lib/format";

import { Card } from "../Card";
import { Icon, type IconName } from "../Icon";
import d from "./Detail.module.css";
import styles from "./ProcessingTrace.module.css";

const OUTCOME: Record<string, { label: string; tone: string; icon: IconName }> = {
  ok: { label: "OK", tone: "var(--c-ok)", icon: "check" },
  repaired: { label: "Repaired", tone: "var(--c-info)", icon: "refresh" },
  fallback: { label: "Fallback", tone: "var(--c-warn)", icon: "shield" },
  error: { label: "Error", tone: "var(--c-alarm)", icon: "alert" },
};

function Outcome({ outcome }: { outcome: string }) {
  const meta = OUTCOME[outcome] ?? {
    label: capitalize(outcome),
    tone: "var(--c-muted)",
    icon: "info" as const,
  };
  return (
    <span className={styles.outcome} data-outcome={outcome} style={{ "--tone": meta.tone } as CSSProperties}>
      <Icon name={meta.icon} size={12} />
      {meta.label}
    </span>
  );
}

export function ProcessingTrace({ steps }: { steps: Step[] }) {
  return (
    <Card title="Processing trace" aside={steps.length ? `run ${steps[0]!.run}` : undefined}>
      {steps.length === 0 ? (
        <p className={d.muted}>No pipeline steps recorded yet.</p>
      ) : (
        <ol className={styles.steps}>
          {steps.map((step, i) => (
            <li key={`${step.step}-${i}`} className={styles.step}>
              <div className={styles.stepRow}>
                <span className={styles.stepName}>{capitalize(step.step)}</span>
                <Outcome outcome={step.outcome} />
                <span className={styles.stats}>
                  <span>
                    {step.provider}
                    {step.model ? ` / ${step.model}` : null}
                  </span>
                  <span>
                    {step.attempts} {step.attempts === 1 ? "attempt" : "attempts"}
                  </span>
                  <span>{formatLatency(step.latency_ms)}</span>
                </span>
              </div>
              {step.error ? (
                <details className={`${d.disclosure} ${styles.error}`}>
                  <summary>
                    <Icon name="chevronRight" size={14} />
                    Error details
                  </summary>
                  <pre className={d.pre}>{step.error}</pre>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
