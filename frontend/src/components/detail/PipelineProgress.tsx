import type { Status } from "@/api/schemas";

import { Icon } from "../Icon";
import { Skeleton } from "../Skeleton";
import { Spinner } from "../Spinner";

const STAGES: Array<{ status: Status; label: string }> = [
  { status: "pending", label: "Queued" },
  { status: "extracting", label: "Extracting facts" },
  { status: "assessing", label: "Assessing risk" },
];

/** Stepper + skeleton cards shown while the pipeline runs (the detail query polls meanwhile). */
export function PipelineProgress({ status }: { status: Status }) {
  const current = STAGES.findIndex((s) => s.status === status);
  return (
    <section aria-labelledby="pipeline-progress" className="card px-4 py-4">
      <h3 id="pipeline-progress" className="text-sm font-semibold text-slate-900">
        Analysis in progress
      </h3>
      <p className="mt-0.5 text-sm text-slate-600" role="status" aria-live="polite">
        {STAGES[current]?.label ?? "Working"}… this page updates automatically.
      </p>
      <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {STAGES.map((stage, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <li
              key={stage.status}
              className={`flex items-center gap-1.5 text-xs font-medium ${
                state === "todo"
                  ? "text-slate-400"
                  : state === "active"
                    ? "text-indigo-700"
                    : "text-slate-700"
              }`}
              aria-current={state === "active" ? "step" : undefined}
            >
              {state === "done" ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
              {state === "active" ? <Spinner /> : null}
              {state === "todo" ? (
                <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
              ) : null}
              {stage.label}
            </li>
          );
        })}
      </ol>
      <div className="mt-4 space-y-2" aria-hidden="true">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </section>
  );
}
