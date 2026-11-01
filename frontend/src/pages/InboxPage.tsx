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

/**
 * Master–detail. From `md` up: list column + detail pane, each scrolling on its own.
 * Below `md`: only one is shown — the list at "/", the detail at "/emails/:id" (with a
 * back link). Pure CSS switching keyed on the route, so no resize listeners.
 */
export function InboxPage() {
  const { id } = useParams<{ id: string }>();
  const { filters, update, search } = useInboxFilters();
  const query = useEmails({ risk: filters.risk, q: filters.q || undefined });
  const clear = useCallback(() => update({ risk: undefined, q: "" }), [update]);

  return (
    <div className="mx-auto flex h-full max-w-screen-2xl">
      <section
        aria-labelledby="inbox-heading"
        className={`${id ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-slate-200 bg-white md:w-80 md:border-r lg:w-96`}
      >
        <div className="flex items-baseline justify-between px-4 pt-4">
          <h1 id="inbox-heading" className="text-lg font-semibold text-slate-900">
            Inbox
          </h1>
          {query.data ? (
            <span className="text-xs text-slate-500" aria-live="polite">
              {pluralize(query.data.total, "email")}
            </span>
          ) : null}
        </div>
        <InboxFilters filters={filters} onChange={update} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmailList query={query} filters={filters} selectedId={id} search={search} onClearFilters={clear} />
        </div>
        <ProviderChain className="border-t border-slate-200 px-4 py-2" />
      </section>

      <section
        aria-label="Email detail"
        className={`${id ? "block" : "hidden md:block"} min-w-0 flex-1 overflow-y-auto`}
        key={id ?? "none"}
      >
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
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
