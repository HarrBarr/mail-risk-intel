import { forwardRef } from "react";
import { Link } from "react-router-dom";

import type { EmailDetail } from "@/api/schemas";
import { formatLongDate } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/risk";

import { Icon } from "../Icon";
import { RiskBadge } from "../RiskBadge";
import styles from "./DetailHeader.module.css";

interface Props {
  email: EmailDetail;
  backTo: string;
}

export const DetailHeader = forwardRef<HTMLHeadingElement, Props>(function DetailHeader(
  { email, backTo },
  ref,
) {
  return (
    <header className={styles.header}>
      <Link to={backTo} className={`btn btn-ghost ${styles.back}`}>
        <Icon name="chevronLeft" />
        Back to inbox
      </Link>
      <div className={styles.titleRow}>
        <h2 ref={ref} tabIndex={-1} className={styles.title}>
          {email.subject || "(no subject)"}
        </h2>
        <RiskBadge level={email.risk?.level ?? null} status={email.status} size="md" />
      </div>
      <dl className={styles.meta}>
        <dt>From</dt>
        <dd className={styles.sender}>{email.sender || "Unknown sender"}</dd>
        <dt>To</dt>
        <dd>{email.recipients.length ? email.recipients.join(", ") : "—"}</dd>
        <dt>Date</dt>
        <dd>
          <time dateTime={email.date ?? undefined}>{formatLongDate(email.date)}</time>
        </dd>
        <dt>Status</dt>
        <dd>
          {STATUS_LABEL[email.status]}
          <span className={styles.source}> · {email.source}</span>
        </dd>
      </dl>
    </header>
  );
});
