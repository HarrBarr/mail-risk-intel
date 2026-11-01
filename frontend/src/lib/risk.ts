import type { Level, Status } from "@/api/schemas";

export const RISK_LEVELS = ["none", "low", "medium", "high"] as const satisfies readonly Level[];

export const RISK_RANK: Record<Level, number> = { none: 0, low: 1, medium: 2, high: 3 };

interface RiskMeta {
  label: string;
  /** Tailwind classes for the badge (tinted background, dark text: >= 7:1 contrast). */
  badge: string;
  /** Solid swatch for meters/dots. */
  dot: string;
  /** Hex for canvas drawing (graph rings). */
  hex: string;
  description: string;
}

/*
 * Palette: emerald / sky / amber / red. Chosen so adjacent levels differ in hue *and*
 * lightness (blue vs amber is safe for the common red-green deficiencies), and every
 * badge also carries its level as text plus a 0–3 bar meter, so color is never the
 * only signal.
 */
export const RISK_META: Record<Level, RiskMeta> = {
  none: {
    label: "No risk",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/30",
    dot: "bg-emerald-600",
    hex: "#059669",
    description: "No risk indicators found",
  },
  low: {
    label: "Low",
    badge: "bg-sky-50 text-sky-800 ring-sky-600/30",
    dot: "bg-sky-600",
    hex: "#0284c7",
    description: "Minor indicators, worth a glance",
  },
  medium: {
    label: "Medium",
    badge: "bg-amber-50 text-amber-900 ring-amber-600/40",
    dot: "bg-amber-500",
    hex: "#d97706",
    description: "Needs review",
  },
  high: {
    label: "High",
    badge: "bg-red-50 text-red-800 ring-red-600/30",
    dot: "bg-red-600",
    hex: "#dc2626",
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
