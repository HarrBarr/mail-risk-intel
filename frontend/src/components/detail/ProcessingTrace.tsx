import type { Step } from "@/api/schemas";
import { capitalize, formatLatency } from "@/lib/format";

import { Card } from "../Card";
import { Icon, type IconName } from "../Icon";

const OUTCOME: Record<string, { label: string; className: string; icon: IconName }> = {
  ok: { label: "OK", className: "bg-emerald-50 text-emerald-800 ring-emerald-600/30", icon: "check" },
  repaired: { label: "Repaired", className: "bg-sky-50 text-sky-800 ring-sky-600/30", icon: "refresh" },
  fallback: { label: "Fallback", className: "bg-amber-50 text-amber-900 ring-amber-600/40", icon: "shield" },
  error: { label: "Error", className: "bg-red-50 text-red-800 ring-red-600/30", icon: "alert" },
};

function Outcome({ outcome }: { outcome: string }) {
  const meta = OUTCOME[outcome] ?? {
    label: capitalize(outcome),
    className: "bg-slate-100 text-slate-700 ring-slate-300",
    icon: "info" as const,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}
    >
      <Icon name={meta.icon} className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export function ProcessingTrace({ steps }: { steps: Step[] }) {
  return (
    <Card title="Processing trace" aside={steps.length ? `run ${steps[0]!.run}` : undefined}>
      {steps.length === 0 ? (
        <p className="text-sm text-slate-500">No pipeline steps recorded yet.</p>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={`${step.step}-${i}`} className="rounded-md border border-slate-200 px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-medium text-slate-900">{capitalize(step.step)}</span>
                <Outcome outcome={step.outcome} />
                <span className="ml-auto flex flex-wrap gap-x-3 text-xs text-slate-500">
                  <span>
                    {step.provider}
                    {step.model ? <span className="font-mono"> / {step.model}</span> : null}
                  </span>
                  <span>
                    {step.attempts} {step.attempts === 1 ? "attempt" : "attempts"}
                  </span>
                  <span>{formatLatency(step.latency_ms)}</span>
                </span>
              </div>
              {step.error ? (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-xs font-medium text-red-700 hover:underline">
                    Error details
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-red-50 p-2 font-mono text-xs text-red-900">
                    {step.error}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
