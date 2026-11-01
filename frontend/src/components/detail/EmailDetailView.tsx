import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { useEmail } from "@/api/hooks";
import { isInFlight } from "@/lib/risk";

import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { Icon } from "../Icon";
import { DetailHeader } from "./DetailHeader";
import { DetailSkeleton } from "./DetailSkeleton";
import { EntitiesPanel } from "./EntitiesPanel";
import { ExtractionCard } from "./ExtractionCard";
import { FailedNotice } from "./FailedNotice";
import { OriginalContent } from "./OriginalContent";
import { PipelineProgress } from "./PipelineProgress";
import { ProcessingTrace } from "./ProcessingTrace";
import { RiskCard } from "./RiskCard";

interface Props {
  id: string;
  /** Inbox URL including current filters, for the mobile back button. */
  backTo: string;
}

export function EmailDetailView({ id, backTo }: Props) {
  const query = useEmail(id);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const loaded = Boolean(query.data);

  // On mobile the detail replaces the list, so move focus to its heading for screen readers.
  useEffect(() => {
    if (loaded && window.matchMedia?.("(max-width: 767px)").matches) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [id, loaded]);

  if (query.isPending) return <DetailSkeleton />;

  if (query.isError && !query.data) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return notFound ? (
      <EmptyState
        icon="search"
        title="Email not found"
        action={
          <Link to={backTo} className="btn-secondary">
            <Icon name="chevronLeft" /> Back to inbox
          </Link>
        }
      >
        It may have been removed, or the link is wrong.
      </EmptyState>
    ) : (
      <ErrorState
        title="Couldn't load this email"
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const email = query.data;
  const running = isInFlight(email.status);

  return (
    <article className="space-y-4" aria-busy={running || undefined}>
      <DetailHeader ref={headingRef} email={email} backTo={backTo} />
      {email.status === "failed" ? <FailedNotice id={email.id} error={email.error} /> : null}
      {running ? <PipelineProgress status={email.status} /> : null}
      {!running && email.risk ? <RiskCard risk={email.risk} /> : null}
      {!running && email.extraction ? (
        <ExtractionCard extraction={email.extraction} attachments={email.attachments} />
      ) : null}
      {!running && email.status === "done" ? (
        <EntitiesPanel entities={email.entities} relationships={email.relationships} />
      ) : null}
      <OriginalContent raw={email.raw_content} />
      {email.steps.length > 0 ? <ProcessingTrace steps={email.steps} /> : null}
    </article>
  );
}
