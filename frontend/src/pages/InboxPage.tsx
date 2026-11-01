import { useCallback } from "react";
import { useParams } from "react-router-dom";

import { useEmails } from "@/api/hooks";
import { EmailDetailView } from "@/components/detail/EmailDetailView";
import { EmptyState } from "@/components/EmptyState";
import { EmailList } from "@/components/inbox/EmailList";
import { InboxFilters } from "@/components/inbox/InboxFilters";
import { ProviderChain } from "@/components/layout/ProviderChain";
import { pluralize } from "@/lib/format";
import { useInboxFilters } from "@/lib/useInboxFilters";

import styles from "./InboxPage.module.css";

/**
 * Master–detail. From 768px up: list column + detail pane, each scrolling on its own.
 * Below 768px: only one is shown — the list at "/", the detail at "/emails/:id" (with a
 * back link). Pure CSS switching keyed on the route (`data-has-selection`), no resize listeners.
 */
export function InboxPage() {
  const { id } = useParams<{ id: string }>();
  const { filters, update, search } = useInboxFilters();
  const query = useEmails({ risk: filters.risk, q: filters.q || undefined });
  const clear = useCallback(() => update({ risk: undefined, q: "" }), [update]);

  return (
    <div className={styles.page} data-has-selection={id ? "true" : "false"}>
      <section aria-labelledby="inbox-heading" className={styles.list}>
        <div className={styles.listHead}>
          <h1 id="inbox-heading" className={styles.heading}>
            Inbox
          </h1>
          {query.data ? (
            <span className={styles.total} aria-live="polite">
              {pluralize(query.data.total, "email")}
            </span>
          ) : null}
        </div>
        <InboxFilters filters={filters} onChange={update} />
        <div className={styles.listScroll}>
          <EmailList query={query} filters={filters} selectedId={id} search={search} onClearFilters={clear} />
        </div>
        <ProviderChain />
      </section>

      <section aria-label="Email detail" className={styles.detail} key={id ?? "none"}>
        <div className={styles.detailInner}>
          {id ? (
            <EmailDetailView id={id} backTo={`/${search}`} />
          ) : (
            <EmptyState icon="mail" title="Select an email">
              Pick a message from the list to see its risk assessment, extracted facts and entities.
            </EmptyState>
          )}
        </div>
      </section>
    </div>
  );
}
