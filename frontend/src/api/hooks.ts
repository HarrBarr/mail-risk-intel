import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isInFlight } from "@/lib/risk";

import { ApiError, api, type EmailFilters } from "./client";
import type { Level } from "./schemas";

export const POLL_MS = 2000;

export const queryKeys = {
  health: ["health"] as const,
  emails: (filters: EmailFilters) => ["emails", "list", filters] as const,
  emailsAll: ["emails"] as const,
  email: (id: string) => ["emails", "detail", id] as const,
  graph: (minRisk: Level | undefined) => ["graph", minRisk ?? "all"] as const,
  graphAll: ["graph"] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => api.health(signal),
    refetchInterval: 30_000,
    retry: 1,
  });
}

/** Inbox list. Polls every 2 s while any visible email is still being processed. */
export function useEmails(filters: EmailFilters) {
  return useQuery({
    queryKey: queryKeys.emails(filters),
    queryFn: ({ signal }) => api.listEmails(filters, signal),
    placeholderData: keepPreviousData,
    // in_flight is mailbox-wide, so a risk filter that hides pending emails doesn't stop polling.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && (data.in_flight > 0 || data.items.some((e) => isInFlight(e.status))) ? POLL_MS : false;
    },
  });
}

/** Email detail. Polls while the pipeline is running for it. */
export function useEmail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.email(id ?? ""),
    queryFn: ({ signal }) => api.getEmail(id ?? "", signal),
    enabled: Boolean(id),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
    refetchInterval: (query) => (query.state.data && isInFlight(query.state.data.status) ? POLL_MS : false),
  });
}

export function useGraph(minRisk: Level | undefined) {
  return useQuery({
    queryKey: queryKeys.graph(minRisk),
    queryFn: ({ signal }) => api.graph(minRisk, signal),
    placeholderData: keepPreviousData,
  });
}

export type NewEmail = { kind: "text"; text: string } | { kind: "file"; file: File };

export function useCreateEmail() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewEmail) =>
      input.kind === "text" ? api.createFromText(input.text) : api.createFromFile(input.file),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.emailsAll });
      void client.invalidateQueries({ queryKey: queryKeys.health });
    },
  });
}

export function useReprocess(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.reprocess(id),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.emailsAll });
      void client.invalidateQueries({ queryKey: queryKeys.graphAll });
    },
  });
}
