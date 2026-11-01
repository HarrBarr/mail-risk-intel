import { Icon } from "../Icon";
import styles from "./OriginalContent.module.css";

export function OriginalContent({ raw }: { raw: string }) {
  return (
    <details className={`card ${styles.details}`}>
      <summary className={styles.summary}>
        <h3 className={styles.title}>Original content</h3>
        <span className={styles.toggle}>
          <span className={styles.show}>Show</span>
          <span className={styles.hide}>Hide</span>
          <Icon name="chevronDown" className={styles.chevron} />
        </span>
      </summary>
      <pre className={styles.raw}>{raw}</pre>
    </details>
  );
}
