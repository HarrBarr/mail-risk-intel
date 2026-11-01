import { cx } from "@/lib/cx";
import { errorMessage } from "@/lib/errors";

import { Icon } from "./Icon";
import styles from "./StateBlock.module.css";

interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

export function ErrorState({
  title = "Couldn't load this",
  error,
  onRetry,
  retrying,
  compact,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cx(styles.block, compact && styles.compact)}>
      <div className={cx(styles.icon, styles.iconError)}>
        <Icon name="alert" size={20} />
      </div>
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{errorMessage(error)}</p>
      {onRetry ? (
        <div className={styles.action}>
          <button type="button" className="btn btn-secondary" onClick={onRetry} disabled={retrying}>
            <Icon name="refresh" className={retrying ? styles.spinning : undefined} />
            {retrying ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
