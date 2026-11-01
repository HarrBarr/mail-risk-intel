/**
 * The API returns naive ISO timestamps (no offset) that are UTC by convention;
 * treat them as UTC so the browser converts them to local time correctly.
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const sameYear = (a: Date, b: Date) => a.getFullYear() === b.getFullYear();

/** Compact date for list rows: "14:05" today, "Jun 8" this year, "Jun 8, 2025" otherwise. */
export function formatShortDate(value: string | null | undefined, now: Date = new Date()): string {
  const date = parseApiDate(value);
  if (!date) return "—";
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear(date, now) ? {} : { year: "numeric" }),
  });
}

export function formatLongDate(value: string | null | undefined): string {
  const date = parseApiDate(value);
  if (!date) return "No date";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "sent_email_to" / "credential-phishing" → "sent email to" / "credential phishing". */
export function humanize(value: string): string {
  return value.replace(/[_-]+/g, " ").trim();
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
