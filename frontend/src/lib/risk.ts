import type { Level, Status } from "@/api/schemas";

export const RISK_LEVELS = ["none", "low", "medium", "high"] as const satisfies readonly Level[];

export const RISK_RANK: Record<Level, number> = { none: 0, low: 1, medium: 2, high: 3 };

interface RiskMeta {
  label: string;
  /** CSS custom property for DOM styling (see styles/tokens.css). */
  cssVar: string;
  /** Hex for canvas drawing (graph rings) — mirrors the token value. */
  hex: string;
  description: string;
}

/*
 * Palette (dark theme): none = ok mint-green, low = info blue, medium = warn amber,
 * high = alarm red-pink. Adjacent levels differ in hue *and* lightness; every badge
 * also carries its level as text plus a 0–3 bar meter, so color is never the only signal.
 */
export const RISK_META: Record<Level, RiskMeta> = {
  none: {
    label: "No risk",
    cssVar: "var(--risk-none)",
    hex: "#8BF0B0",
    description: "No risk indicators found",
  },
  low: {
    label: "Low",
    cssVar: "var(--risk-low)",
    hex: "#8FC8FF",
    description: "Minor indicators, worth a glance",
  },
  medium: {
    label: "Medium",
    cssVar: "var(--risk-medium)",
    hex: "#FFC48A",
    description: "Needs review",
  },
  high: {
    label: "High",
    cssVar: "var(--risk-high)",
    hex: "#FF6B8A",
    description: "Likely fraud, leak or policy breach",
  },
};

export const IN_FLIGHT: readonly Status[] = ["pending", "extracting", "assessing"];

export function isInFlight(status: Status): boolean {
  return IN_FLIGHT.includes(status);
}

export const STATUS_LABEL: Record<Status, string> = {
  pending: "Queued",
  extracting: "Extracting",
  assessing: "Assessing risk",
  done: "Done",
  failed: "Failed",
};

/** Text of the safety-floor note the backend appends to a rationale, e.g. "[Raised from 'low' to 'medium' by …]". */
const RAISED_RE = /\s*\[(Raised from [^\]]*)\]\s*$/;

export function splitRationale(rationale: string): { text: string; raisedNote: string | null } {
  const match = RAISED_RE.exec(rationale);
  if (!match) {
    // Floor note not at the end (unexpected) — still detect it, but leave the text intact.
    return {
      text: rationale,
      raisedNote: rationale.includes("[Raised from") ? "Raised by deterministic checks" : null,
    };
  }
  return { text: rationale.slice(0, match.index).trim(), raisedNote: match[1] ?? null };
}

export function isFallbackProvider(provider: string | null | undefined): boolean {
  return provider === "rules";
}
