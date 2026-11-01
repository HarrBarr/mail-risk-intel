import { Skeleton } from "../Skeleton";
import styles from "./DetailSkeleton.module.css";

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading email" className={styles.wrap}>
      <div className={styles.lines}>
        <Skeleton width="75%" height={24} />
        <Skeleton width="50%" height={14} />
        <Skeleton width="33%" height={14} />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className={`card ${styles.card}`}>
          <Skeleton width={96} height={14} />
          <Skeleton height={10} />
          <Skeleton width="83%" height={10} />
          <Skeleton width="66%" height={10} />
        </div>
      ))}
    </div>
  );
}
