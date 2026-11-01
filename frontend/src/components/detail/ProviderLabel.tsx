import styles from "./ProviderLabel.module.css";

export function ProviderLabel({ provider, model }: { provider: string; model: string }) {
  return (
    <span className={styles.label}>
      processed by <span className={styles.provider}>{provider}</span>
      {model ? <span className={styles.model}> / {model}</span> : null}
    </span>
  );
}
