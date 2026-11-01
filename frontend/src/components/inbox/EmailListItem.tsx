import { Link } from "react-router-dom";

import type { EmailSummary } from "@/api/schemas";
import { formatShortDate } from "@/lib/format";
import { isFallbackProvider } from "@/lib/risk";

import { FallbackChip } from "../FallbackChip";
import { RiskBadge } from "../RiskBadge";
import styles from "./EmailListItem.module.css";

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
        className={styles.item}
      >
        <div className={styles.top}>
          <p className={styles.sender}>{email.sender || "Unknown sender"}</p>
          <time dateTime={email.date ?? undefined} className={styles.date}>
            {formatShortDate(email.date)}
          </time>
        </div>
        <p className={styles.subject}>{email.subject || "(no subject)"}</p>
        {preview ? <p className={styles.preview}>{preview}</p> : null}
        <div className={styles.meta}>
          <RiskBadge level={email.risk_level} status={email.status} />
          {email.status === "done" && isFallbackProvider(email.processed_by) ? <FallbackChip /> : null}
        </div>
      </Link>
    </li>
  );
}
