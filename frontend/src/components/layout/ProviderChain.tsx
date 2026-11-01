import { useHealth } from "@/api/hooks";
import { isInFlight } from "@/lib/risk";

import { Icon } from "../Icon";
import styles from "./ProviderChain.module.css";

/** "Pipeline: groq → ollama → rules · 2 in queue" — small, for the bottom of the inbox column. */
export function ProviderChain() {
  const { data } = useHealth();
  if (!data) return null;
  const queued = Object.entries(data.queue)
    .filter(([status]) => isInFlight(status as never))
    .reduce((sum, [, n]) => sum + n, 0);

  return (
    <p className={styles.chain}>
      <Icon name="cpu" size={14} />
      <span>Pipeline:</span>
      <span className={styles.providers}>{data.providers.join(" → ")}</span>
      {queued > 0 ? <span>· {queued} in queue</span> : null}
    </p>
  );
}
