import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Icon, type IconName } from "./Icon";
import styles from "./StateBlock.module.css";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon = "inbox", title, children, action, compact = false }: EmptyStateProps) {
  return (
    <div className={cx(styles.block, compact && styles.compact)}>
      <div className={styles.icon}>
        <Icon name={icon} size={20} />
      </div>
      <p className={styles.title}>{title}</p>
      {children ? <div className={styles.text}>{children}</div> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
