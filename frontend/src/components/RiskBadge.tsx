import type { Level, Status } from "@/api/schemas";
import { RISK_META, RISK_RANK, STATUS_LABEL, isInFlight } from "@/lib/risk";

import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

interface RiskBadgeProps {
  level: Level | null;
  /** When the email isn't done yet the badge shows a neutral processing/failed state instead. */
  status?: Status;
  size?: "sm" | "md";
  className?: string;
}

const SIZE = {
  sm: "gap-1.5 px-2 py-0.5 text-xs",
  md: "gap-2 px-2.5 py-1 text-sm",
};

/** Three bars, filled up to the level: a shape cue so the level never relies on color alone. */
function Meter({ level }: { level: Level }) {
  const rank = RISK_RANK[level];
  return (
    <span aria-hidden="true" className="flex items-end gap-px">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`w-[3px] rounded-sm ${n <= rank ? "bg-current" : "bg-current opacity-20"}`}
          style={{ height: `${4 + n * 2}px` }}
        />
      ))}
    </span>
  );
}

export function RiskBadge({ level, status = "done", size = "sm", className = "" }: RiskBadgeProps) {
  const base = `inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${SIZE[size]} ${className}`;

  if (status === "failed") {
    return (
      <span className={`${base} bg-slate-100 text-slate-700 ring-slate-400/40`} data-state="failed">
        <Icon name="alert" className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }

  if (isInFlight(status) || level === null) {
    return (
      <span className={`${base} bg-slate-100 text-slate-700 ring-slate-300/60`} data-state="processing">
        {isInFlight(status) ? <Spinner /> : null}
        {isInFlight(status) ? STATUS_LABEL[status] : "Not assessed"}
      </span>
    );
  }

  const meta = RISK_META[level];
  return (
    <span
      className={`${base} ${meta.badge}`}
      data-level={level}
      title={meta.description}
      aria-label={level === "none" ? "Risk: none" : `Risk: ${meta.label.toLowerCase()}`}
    >
      <Meter level={level} />
      <span aria-hidden="true">{level === "none" ? meta.label : `${meta.label} risk`}</span>
    </span>
  );
}
