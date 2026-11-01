import { forwardRef } from "react";
import { Link } from "react-router-dom";

import type { EmailDetail } from "@/api/schemas";
import { formatLongDate } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/risk";

import { Icon } from "../Icon";
import { RiskBadge } from "../RiskBadge";

interface Props {
  email: EmailDetail;
  backTo: string;
}

export const DetailHeader = forwardRef<HTMLHeadingElement, Props>(function DetailHeader(
  { email, backTo },
  ref,
) {
  return (
    <header className="space-y-3">
      <Link to={backTo} className="btn-ghost -ml-2 px-2 md:hidden">
        <Icon name="chevronLeft" />
        Back to inbox
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2
          ref={ref}
          tabIndex={-1}
          className="min-w-0 break-words text-xl font-semibold leading-snug text-slate-900 outline-none"
        >
          {email.subject || "(no subject)"}
        </h2>
        <RiskBadge level={email.risk?.level ?? null} status={email.status} size="md" className="self-start" />
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">From</dt>
        <dd className="break-words font-medium text-slate-900">{email.sender || "Unknown sender"}</dd>
        <dt className="text-slate-500">To</dt>
        <dd className="break-words text-slate-800">
          {email.recipients.length ? email.recipients.join(", ") : "—"}
        </dd>
        <dt className="text-slate-500">Date</dt>
        <dd className="text-slate-800">
          <time dateTime={email.date ?? undefined}>{formatLongDate(email.date)}</time>
        </dd>
        <dt className="text-slate-500">Status</dt>
        <dd className="text-slate-800">
          {STATUS_LABEL[email.status]}
          <span className="text-slate-500"> · {email.source}</span>
        </dd>
      </dl>
    </header>
  );
});
