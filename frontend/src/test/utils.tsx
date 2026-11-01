import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

export function renderWithProviders(ui: ReactElement, { route = "/" }: { route?: string } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[route]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          {ui}
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

/**
 * Stubs global fetch with a tiny router: the first handler whose key is a prefix of
 * "METHOD /path" wins. Unmatched requests fail loudly.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");
    const key = `${(init?.method ?? "GET").toUpperCase()} ${url.pathname}`;
    const match = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((k) => key === k || key.startsWith(k));
    if (!match) throw new Error(`Unmocked request: ${key}`);
    return routes[match]!(url, init);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export const healthRules = { status: "ok", mode: "rules", providers: ["rules"], queue: { done: 1 } };
export const healthLlm = { status: "ok", mode: "llm", providers: ["groq", "rules"], queue: {} };

export function emailSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: "E001",
    source: "seed",
    sender: "ceo@arclne-corp.com",
    subject: "Urgent wire",
    date: "2026-06-01T09:30:00",
    status: "done",
    risk_level: "high",
    risk_tags: ["wire-request"],
    summary: "Please wire funds today.",
    processed_by: "groq",
    error: null,
    ...overrides,
  };
}

/** A promise that never settles: keeps a query in its loading state. */
export const never = () => new Promise<Response>(() => {});
