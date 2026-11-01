import type { ReactNode } from "react";

export function Chip({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-xs font-medium ${
        className || "bg-slate-100 text-slate-700"
      }`}
    >
      {children}
    </span>
  );
}
