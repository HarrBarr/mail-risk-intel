import { Link } from "react-router-dom";

import type { EmailSummary } from "@/api/schemas";
import { formatShortDate } from "@/lib/format";
import { isFallbackProvider } from "@/lib/risk";

import { FallbackChip } from "../FallbackChip";
import { RiskBadge } from "../RiskBadge";

interface Props {
  email: EmailSummary;
  selected: boolean;
  search: string;
}

export function EmailListItem({ email, selected, search }: Props) {
  const preview = email.status === "failed" ? (email.error ?? "Processing failed") : email.summary;
  return (
    <li>
      <Link
        to={`/emails/${encodeURIComponent(email.id)}${search}`}
        aria-current={selected ? "page" : undefined}
        className={`block border-l-2 px-4 py-3 transition-colors focus-visible:ring-inset focus-visible:ring-offset-0 ${
          selected ? "border-indigo-600 bg-indigo-50/60" : "border-transparent hover:bg-slate-50"
        }`}
      >
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
            {email.sender || "Unknown sender"}
          </p>
          <time dateTime={email.date ?? undefined} className="shrink-0 text-xs text-slate-500">
            {formatShortDate(email.date)}
          </time>
        </div>
        <p className="mt-0.5 truncate text-sm text-slate-800">{email.subject || "(no subject)"}</p>
        {preview ? <p className="mt-0.5 truncate text-xs text-slate-500">{preview}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <RiskBadge level={email.risk_level} status={email.status} />
          {email.status === "done" && isFallbackProvider(email.processed_by) ? <FallbackChip /> : null}
        </div>
      </Link>
    </li>
  );
}
