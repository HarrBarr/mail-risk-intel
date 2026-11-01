import type { ReactNode } from "react";

interface CardProps {
  title: string;
  /** Short right-aligned meta, e.g. "processed by rules". */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, aside, children, className = "" }: CardProps) {
  const id = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={`card ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3">
        <h3 id={id} className="text-sm font-semibold text-slate-900">
          {title}
        </h3>
        {aside ? <div className="text-xs text-slate-500">{aside}</div> : null}
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
