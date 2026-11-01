import { useHealth } from "@/api/hooks";
import { isInFlight } from "@/lib/risk";

import { Icon } from "../Icon";

/** "Pipeline: groq → ollama → rules · 2 in queue" — small, for the bottom of the inbox column. */
export function ProviderChain({ className = "" }: { className?: string }) {
  const { data } = useHealth();
  if (!data) return null;
  const queued = Object.entries(data.queue)
    .filter(([status]) => isInFlight(status as never))
    .reduce((sum, [, n]) => sum + n, 0);

  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 ${className}`}>
      <Icon name="cpu" className="h-3.5 w-3.5" />
      <span>Pipeline:</span>
      <span className="font-medium text-slate-700">{data.providers.join(" → ")}</span>
      {queued > 0 ? <span>· {queued} in queue</span> : null}
    </p>
  );
}
