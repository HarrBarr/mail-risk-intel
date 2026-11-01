import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { levelSchema, type Level } from "@/api/schemas";

export interface InboxFilters {
  risk: Level | undefined;
  q: string;
}

/**
 * Inbox filters live in the URL (?risk=high&q=wire) so they survive opening an email,
 * the mobile back button, reloads and sharing a link.
 */
export function useInboxFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<InboxFilters>(() => {
    const risk = levelSchema.safeParse(params.get("risk"));
    return { risk: risk.success ? risk.data : undefined, q: params.get("q") ?? "" };
  }, [params]);

  const update = useCallback(
    (patch: Partial<InboxFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const search = params.toString();
  return { filters, update, search: search ? `?${search}` : "" };
}
