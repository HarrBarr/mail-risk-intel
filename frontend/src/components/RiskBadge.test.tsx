import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";

import type { Level } from "@/api/schemas";

import styles from "./RiskBadge.module.css";
import { RiskBadge } from "./RiskBadge";

const css = (file: string) => readFileSync(resolve(__dirname, file), "utf8");

/** Value of a custom property declared on :root in tokens.css. */
function token(name: string): string {
  const tokens = css("../styles/tokens.css");
  const direct = new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim() ?? "";
  const alias = /^var\((--[\w-]+)\)$/.exec(direct)?.[1];
  return (alias ? token(alias) : direct).toLowerCase();
}

describe("RiskBadge", () => {
  const cases: Array<[Level, string, string, number]> = [
    ["none", "No risk", "Risk: none", 0],
    ["low", "Low risk", "Risk: low", 1],
    ["medium", "Medium risk", "Risk: medium", 2],
    ["high", "High risk", "Risk: high", 3],
  ];

  it.each(cases)("renders %s with its label, level class and meter", (level, text, accessibleName, bars) => {
    const { container } = render(<RiskBadge level={level} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).toHaveTextContent(text);
    expect(badge).toHaveAttribute("aria-label", accessibleName);
    expect(badge).toHaveAttribute("data-level", level);
    expect(styles[level]).toBeTruthy();
    expect(badge).toHaveClass(styles.badge!, styles[level]!);
    // The level is also conveyed by shape: `bars` of 3 meter bars are filled.
    expect(badge.querySelectorAll(`.${styles.barOn}`)).toHaveLength(bars);
  });

  it("gives every level its own module class and its own color token", () => {
    const classes = cases.map(([level]) => styles[level]);
    expect(new Set(classes).size).toBe(4);

    const moduleCss = css("./RiskBadge.module.css");
    const colors = cases.map(([level]) => {
      // e.g. `.high { --tone: var(--risk-high);` — the class wires the level to its token…
      const rule = new RegExp(`\\.${level}\\s*\\{[^}]*--tone:\\s*var\\((--risk-${level})\\)`).exec(moduleCss);
      expect(rule, `.${level} should set --tone from --risk-${level}`).not.toBeNull();
      // …and the token resolves to a concrete palette color.
      return token(rule![1]!);
    });
    expect(colors).toEqual(["#8bf0b0", "#8fc8ff", "#ffc48a", "#ff6b8a"]);
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
    expect(badge).toHaveClass(styles.neutral!);
    expect(badge).not.toHaveAttribute("data-level");
    expect(badge.querySelector("svg[aria-hidden]")).not.toBeNull(); // spinner
  });

  it("shows a failed state that ignores any stale level", () => {
    render(<RiskBadge level="high" status="failed" />);
    const badge = screen.getByText("Failed");
    expect(badge).toHaveClass(styles.failed!);
    expect(badge).not.toHaveClass(styles.high!);
    expect(screen.queryByText("High risk")).not.toBeInTheDocument();
  });
});
