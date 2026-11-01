import type { Status } from "@/api/schemas";

import { Icon } from "../Icon";
import { Skeleton } from "../Skeleton";
import { Spinner } from "../Spinner";
import styles from "./PipelineProgress.module.css";

const STAGES: Array<{ status: Status; label: string }> = [
  { status: "pending", label: "Queued" },
  { status: "extracting", label: "Extracting facts" },
  { status: "assessing", label: "Assessing risk" },
];

/** Stepper + skeleton lines shown while the pipeline runs (the detail query polls meanwhile). */
export function PipelineProgress({ status }: { status: Status }) {
  const current = STAGES.findIndex((s) => s.status === status);
  return (
    <section aria-labelledby="pipeline-progress" className={`card ${styles.card}`}>
      <div className={styles.progressLine} aria-hidden="true" />
      <h3 id="pipeline-progress" className={styles.title}>
        Analysis in progress
      </h3>
      <p className={styles.status} role="status" aria-live="polite">
        {STAGES[current]?.label ?? "Working"}… this page updates automatically.
      </p>
      <ol className={styles.stages}>
        {STAGES.map((stage, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <li
              key={stage.status}
              className={styles.stage}
              data-state={state}
              aria-current={state === "active" ? "step" : undefined}
            >
              {state === "done" ? <Icon name="check" size={14} /> : null}
              {state === "active" ? <Spinner /> : null}
              {state === "todo" ? <span className={styles.todoDot} aria-hidden="true" /> : null}
              {stage.label}
            </li>
          );
        })}
      </ol>
      <div className={styles.skeleton} aria-hidden="true">
        <Skeleton width="33%" height={14} />
        <Skeleton height={10} />
        <Skeleton width="83%" height={10} />
        <Skeleton width="66%" height={10} />
      </div>
    </section>
  );
}
