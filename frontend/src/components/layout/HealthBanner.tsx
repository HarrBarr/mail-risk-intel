import { useHealth } from "@/api/hooks";

import { Icon } from "../Icon";

/** Shown only when it matters: the API is unreachable, or no LLM is available (rules mode). */
export function HealthBanner() {
  const health = useHealth();

  if (health.isError && !health.data) {
    return (
      <div role="alert" className="border-b border-red-200 bg-red-50 text-red-900">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-2 px-4 py-2 text-sm">
          <Icon name="alert" className="h-4 w-4 text-red-700" />
          <span className="min-w-0 flex-1">Can't reach the API. Data may be out of date.</span>
          <button
            type="button"
            className="rounded px-2 py-1 font-medium underline underline-offset-2 hover:bg-red-100"
            onClick={() => void health.refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (health.data?.mode !== "rules") return null;

  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-screen-2xl items-start gap-2 px-4 py-2 text-sm">
        <Icon name="info" className="mt-0.5 h-4 w-4 text-amber-700" />
        <p>
          <span className="font-semibold">No LLM reachable</span> — results come from the rule-based fallback.
        </p>
      </div>
    </div>
  );
}
