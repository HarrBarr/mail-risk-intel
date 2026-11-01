import { useReprocess } from "@/api/hooks";
import { errorMessage } from "@/lib/errors";

import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import styles from "./FailedNotice.module.css";

export function FailedNotice({ id, error }: { id: string; error: string | null }) {
  const reprocess = useReprocess(id);
  return (
    <section role="alert" className={styles.notice}>
      <Icon name="alert" size={20} className={styles.icon} />
      <div className={styles.body}>
        <h3 className={styles.title}>Processing failed</h3>
        <p className={styles.message}>{error ?? "The pipeline stopped with an unknown error."}</p>
        {reprocess.isError ? <p className={styles.retryError}>{errorMessage(reprocess.error)}</p> : null}
        <button
          type="button"
          className={`btn btn-danger ${styles.retry}`}
          onClick={() => reprocess.mutate()}
          disabled={reprocess.isPending}
        >
          {reprocess.isPending ? <Spinner size={16} /> : <Icon name="refresh" />}
          {reprocess.isPending ? "Retrying…" : "Retry"}
        </button>
      </div>
    </section>
  );
}
