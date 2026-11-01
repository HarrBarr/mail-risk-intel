import type { Risk } from "@/api/schemas";
import { humanize } from "@/lib/format";
import { RISK_META, isFallbackProvider, splitRationale } from "@/lib/risk";

import { Card } from "../Card";
import { Chip } from "../Chip";
import { FallbackChip } from "../FallbackChip";
import { Icon } from "../Icon";
import { RiskBadge } from "../RiskBadge";
import d from "./Detail.module.css";
import { ProviderLabel } from "./ProviderLabel";
import styles from "./RiskCard.module.css";

export function RiskCard({ risk }: { risk: Risk }) {
  const { text, raisedNote } = splitRationale(risk.rationale);
  return (
    <Card title="Risk" aside={<ProviderLabel provider={risk.provider} model={risk.model} />}>
      <div className={d.row}>
        <RiskBadge level={risk.level} size="md" />
        <span className={styles.description}>{RISK_META[risk.level].description}</span>
        {isFallbackProvider(risk.provider) ? <FallbackChip /> : null}
      </div>

      {raisedNote ? (
        <div className={`${d.callout} ${d.section}`}>
          <Icon name="shield" />
          <p>
            <strong>Safety floor applied.</strong> The model's level was raised by deterministic checks:{" "}
            {raisedNote.replace(/^Raised from /, "from ")}
          </p>
        </div>
      ) : null}

      <div className={d.section}>
        <h4 className={`eyebrow ${d.label}`}>Rationale</h4>
        <p className={d.prose}>{text}</p>
      </div>

      {risk.tags.length ? (
        <div className={d.section}>
          <h4 className={`eyebrow ${d.label}`}>Tags</h4>
          <ul className={d.chips}>
            {risk.tags.map((tag) => (
              <li key={tag}>
                <Chip>{humanize(tag)}</Chip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {risk.signals.length ? (
        <div className={d.section}>
          <h4 className={`eyebrow ${d.label}`}>Deterministic signals</h4>
          <ul className={`${d.box} ${d.rows}`}>
            {risk.signals.map((signal, i) => (
              <li key={`${signal.tag}-${i}`} className={styles.signal}>
                <span className={styles.weight} title="Signal weight">
                  +{signal.weight}
                </span>
                <div className={styles.signalText}>
                  <p className={styles.signalTag}>{humanize(signal.tag)}</p>
                  <p className={styles.evidence}>{signal.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
