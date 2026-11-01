import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/** Pill with a hairline border; pass `dotColor` (any CSS color) for a 6px lead dot. */
export function Chip({
  children,
  className,
  title,
  dotColor,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  dotColor?: string;
}) {
  return (
    <span title={title} className={cx("chip", className)}>
      {dotColor ? <span className="dot" style={{ color: dotColor }} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
