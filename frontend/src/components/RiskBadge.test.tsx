import { render, screen } from "@testing-library/react";

import type { Level } from "@/api/schemas";

import { RiskBadge } from "./RiskBadge";

describe("RiskBadge", () => {
  const cases: Array<[Level, string, string, string]> = [
    ["none", "No risk", "Risk: none", "bg-emerald-50"],
    ["low", "Low risk", "Risk: low", "bg-sky-50"],
    ["medium", "Medium risk", "Risk: medium", "bg-amber-50"],
    ["high", "High risk", "Risk: high", "bg-red-50"],
  ];

  it.each(cases)("renders %s with its label and color", (level, text, accessibleName, colorClass) => {
    const { container } = render(<RiskBadge level={level} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).toHaveTextContent(text);
    expect(badge).toHaveAttribute("aria-label", accessibleName);
    expect(badge).toHaveAttribute("data-level", level);
    expect(badge).toHaveClass(colorClass);
  });

  it("uses a distinct color class per level", () => {
    const classes = cases.map(([level]) => {
      const { container, unmount } = render(<RiskBadge level={level} />);
      const cls = (container.firstElementChild as HTMLElement).className;
      unmount();
      return cls;
    });
    expect(new Set(classes).size).toBe(4);
  });

  it.each([
    ["pending", "Queued"],
    ["extracting", "Extracting"],
    ["assessing", "Assessing risk"],
  ] as const)("shows a neutral processing state while %s", (status, label) => {
    const { container } = render(<RiskBadge level={null} status={status} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).toHaveTextContent(label);
    expect(badge).toHaveAttribute("data-state", "processing");
    expect(badge).toHaveClass("bg-slate-100");
    expect(badge.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("shows a failed state that ignores any stale level", () => {
    render(<RiskBadge level="high" status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("High risk")).not.toBeInTheDocument();
  });
});
