import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppRoutes } from "@/App";
import {
  emailSummary,
  healthLlm,
  healthRules,
  json,
  mockFetch,
  never,
  renderWithProviders,
} from "@/test/utils";

describe("Inbox", () => {
  it("shows a loading skeleton while the list is loading", async () => {
    mockFetch({ "GET /api/health": () => json(healthLlm), "GET /api/emails": never });
    renderWithProviders(<AppRoutes />);
    expect(await screen.findByRole("status", { name: "Loading emails" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no emails", async () => {
    mockFetch({
      "GET /api/health": () => json(healthLlm),
      "GET /api/emails": () => json({ items: [], total: 0, in_flight: 0 }),
    });
    renderWithProviders(<AppRoutes />);
    expect(await screen.findByText("Your inbox is empty")).toBeInTheDocument();
  });

  it("shows a no-matches state with a clear action when filters exclude everything", async () => {
    const fetch = mockFetch({
      "GET /api/health": () => json(healthLlm),
      "GET /api/emails": () => json({ items: [], total: 0, in_flight: 0 }),
    });
    renderWithProviders(<AppRoutes />, { route: "/?risk=high" });
    expect(await screen.findByText("No emails match")).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("risk=high"))).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Your inbox is empty")).toBeInTheDocument();
  });

  it("shows an error state on a 5xx and recovers on retry", async () => {
    let fail = true;
    mockFetch({
      "GET /api/health": () => json(healthLlm),
      "GET /api/emails": () =>
        fail
          ? new Response("boom", { status: 500 })
          : json({ items: [emailSummary()], total: 1, in_flight: 0 }),
    });
    renderWithProviders(<AppRoutes />);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Couldn't load the inbox")).toBeInTheDocument();
    expect(within(alert).getByText(/server ran into a problem/i)).toBeInTheDocument();

    fail = false;
    await userEvent.click(within(alert).getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Urgent wire")).toBeInTheDocument();
  });

  it("shows a network error when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    renderWithProviders(<AppRoutes />);
    expect(await screen.findByText("Couldn't load the inbox")).toBeInTheDocument();
    expect(screen.getAllByText(/can't reach/i).length).toBeGreaterThan(0);
  });

  it("lists emails with risk badges, a fallback chip, and the rules-mode banner", async () => {
    mockFetch({
      "GET /api/health": () => json(healthRules),
      "GET /api/emails": () =>
        json({
          items: [
            emailSummary({ processed_by: "rules" }),
            emailSummary({
              id: "E002",
              subject: "Lunch?",
              status: "pending",
              risk_level: null,
              processed_by: null,
            }),
          ],
          total: 2,
          in_flight: 0,
        }),
    });
    renderWithProviders(<AppRoutes />);
    const first = (await screen.findByText("Urgent wire")).closest("a")!;
    expect(first).toHaveAttribute("href", "/emails/E001");
    expect(within(first).getByLabelText("Risk: high")).toBeInTheDocument();
    expect(within(first).getByText("fallback")).toBeInTheDocument();
    expect(within(screen.getByText("Lunch?").closest("a")!).getByText("Queued")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/No LLM reachable/)).toBeInTheDocument());
  });
});
