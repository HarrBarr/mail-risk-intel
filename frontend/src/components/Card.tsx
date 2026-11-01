import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import styles from "./Card.module.css";

interface CardProps {
  title: string;
  /** Short right-aligned meta, e.g. "processed by rules". */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, aside, children, className }: CardProps) {
  const id = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cx("card", className)}>
      <header className={styles.header}>
        <h3 id={id} className={styles.title}>
          {title}
        </h3>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
