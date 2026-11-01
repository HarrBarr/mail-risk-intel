/* A tiny inline icon set (24px grid, 2px stroke) so we don't ship an icon library. */
const PATHS = {
  mail: "M4 6h16v12H4z M4 7l8 6 8-6",
  graph:
    "M6 7a2 2 0 1 0 0-.01 M18 6a2 2 0 1 0 0-.01 M12 18a2 2 0 1 0 0-.01 M7.5 8.5l3.5 7.5 M16.5 7.5l-3.5 8.5 M8 6.5h8",
  plus: "M12 5v14 M5 12h14",
  search: "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M20 20l-4.5-4.5",
  x: "M6 6l12 12 M18 6L6 18",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  chevronRight: "M9 6l6 6-6 6",
  alert: "M12 4l9 16H3z M12 10v4 M12 17h.01",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v5 M12 8h.01",
  refresh: "M20 11a8 8 0 0 0-14.5-4.5L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.5 4.5L20 16 M20 20v-4h-4",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4",
  file: "M6 3h8l4 4v14H6z M14 3v4h4",
  paperclip: "M16 7l-7.5 7.5a2 2 0 0 0 3 3L19 10a4 4 0 0 0-6-6l-7.5 7.5a6 6 0 0 0 8.5 8.5L20 14",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21a8 8 0 0 1 16 0",
  building: "M5 21V4h10v17 M15 9h4v12 M3 21h18 M8 8h4 M8 12h4 M8 16h4",
  currency: "M12 3v18 M16 7.5C16 6 14.5 5 12 5S8 6 8 8s2 2.5 4 3 4 1 4 3-1.5 3-4 3-4-1-4-2.5",
  card: "M3 6h18v12H3z M3 10h18 M7 15h4",
  pin: "M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z M12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  tag: "M3 12V4h8l10 10-8 8z M7.5 7.5h.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  check: "M5 12.5l4.5 4.5L19 7",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  code: "M8 8l-4 4 4 4 M16 8l4 4-4 4",
  cpu: "M7 7h10v10H7z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4",
  inbox: "M4 13l2.5-8h11l2.5 8v6H4z M4 13h5l1 2h4l1-2h5",
  filter: "M4 5h16l-6 8v6l-4-2v-4z",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  /** Pixel size (square). */
  size?: number;
  className?: string;
  /** Pass a label only for standalone meaningful icons; decorative icons stay hidden from AT. */
  label?: string;
}

export function Icon({ name, size = 16, className, label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
