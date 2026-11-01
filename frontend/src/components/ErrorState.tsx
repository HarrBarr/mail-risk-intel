import { errorMessage } from "@/lib/errors";

import { Icon } from "./Icon";

interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

export function ErrorState({
  title = "Couldn't load this",
  error,
  onRetry,
  retrying,
  compact,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center text-center ${compact ? "px-4 py-6" : "px-6 py-14"}`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700">
        <Icon name="alert" className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{errorMessage(error)}</p>
      {onRetry ? (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry} disabled={retrying}>
          <Icon name="refresh" className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying…" : "Try again"}
        </button>
      ) : null}
    </div>
  );
}
