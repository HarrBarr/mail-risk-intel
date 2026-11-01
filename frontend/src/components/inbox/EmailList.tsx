import type { UseQueryResult } from "@tanstack/react-query";

import type { EmailList as EmailListData } from "@/api/schemas";
import type { InboxFilters } from "@/lib/useInboxFilters";

import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { Skeleton } from "../Skeleton";
import styles from "./EmailList.module.css";
import { EmailListItem } from "./EmailListItem";

interface Props {
  query: UseQueryResult<EmailListData>;
  filters: InboxFilters;
  selectedId: string | undefined;
  search: string;
  onClearFilters: () => void;
}

function ListSkeleton() {
  return (
    <ul aria-hidden="true" className={styles.list}>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className={styles.skeletonRow}>
          <div className={styles.skeletonTop}>
            <Skeleton width="40%" height={14} />
            <Skeleton width={40} height={10} />
          </div>
          <Skeleton width="80%" height={14} />
          <Skeleton width={84} height={20} pill />
        </li>
      ))}
    </ul>
  );
}

export function EmailList({ query, filters, selectedId, search, onClearFilters }: Props) {
  const { data, isPending, isError, error, refetch, isFetching } = query;
  const filtered = Boolean(filters.risk || filters.q);

  if (isPending) {
    return (
      <div role="status" aria-label="Loading emails">
        <ListSkeleton />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <ErrorState
        title="Couldn't load the inbox"
        error={error}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  if (data.items.length === 0) {
    return filtered ? (
      <EmptyState
        icon="filter"
        title="No emails match"
        action={
          <button type="button" className="btn btn-secondary" onClick={onClearFilters}>
            Clear filters
          </button>
        }
      >
        Try a different risk level or search term.
      </EmptyState>
    ) : (
      <EmptyState icon="inbox" title="Your inbox is empty">
        Use <strong className={styles.em}>Add email</strong> to paste text or upload a .txt, .pdf or .eml
        file.
      </EmptyState>
    );
  }

  return (
    <>
      {isError ? (
        <p role="alert" className={styles.stale}>
          Couldn't refresh — showing the last loaded list.
        </p>
      ) : null}
      <ul className={styles.list} aria-busy={isFetching || undefined}>
        {data.items.map((email) => (
          <EmailListItem key={email.id} email={email} selected={email.id === selectedId} search={search} />
        ))}
      </ul>
      {data.total > data.items.length ? (
        <p className={styles.more}>
          Showing {data.items.length} of {data.total}. Narrow the search to see more.
        </p>
      ) : null}
    </>
  );
}
