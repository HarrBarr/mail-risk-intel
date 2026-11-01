import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";

export function NotFoundPage() {
  return (
    <EmptyState
      icon="search"
      title="Page not found"
      action={
        <Link to="/" className="btn btn-secondary">
          Back to inbox
        </Link>
      }
    >
      That address doesn't match anything here.
    </EmptyState>
  );
}
