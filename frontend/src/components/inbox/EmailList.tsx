import type { UseQueryResult } from "@tanstack/react-query";

import type { EmailList as EmailListData } from "@/api/schemas";
import type { InboxFilters } from "@/lib/useInboxFilters";

import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { Skeleton } from "../Skeleton";
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
    <ul aria-hidden="true" className="divide-y divide-slate-100">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="space-y-2 px-4 py-3">
          <div className="flex justify-between gap-4">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-10" />
          </div>
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-5 w-20 rounded-full" />
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
          <button type="button" className="btn-secondary" onClick={onClearFilters}>
            Clear filters
          </button>
        }
      >
        Try a different risk level or search term.
      </EmptyState>
    ) : (
      <EmptyState icon="inbox" title="Your inbox is empty">
        Use <span className="font-medium text-slate-900">Add email</span> to paste text or upload a .txt, .pdf
        or .eml file.
      </EmptyState>
    );
  }

  return (
    <>
      {isError ? (
        <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-800">
          Couldn't refresh — showing the last loaded list.
        </p>
      ) : null}
      <ul className="divide-y divide-slate-100" aria-busy={isFetching || undefined}>
        {data.items.map((email) => (
          <EmailListItem key={email.id} email={email} selected={email.id === selectedId} search={search} />
        ))}
      </ul>
      {data.total > data.items.length ? (
        <p className="px-4 py-3 text-center text-xs text-slate-500">
          Showing {data.items.length} of {data.total}. Narrow the search to see more.
        </p>
      ) : null}
    </>
  );
}
