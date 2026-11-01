import type { Attachment, Extraction } from "@/api/schemas";
import { factMeta, groupFacts } from "@/lib/facts";

import { Card } from "../Card";
import { Icon } from "../Icon";
import d from "./Detail.module.css";
import styles from "./ExtractionCard.module.css";
import { ProviderLabel } from "./ProviderLabel";

interface Props {
  extraction: Extraction;
  /** Attachments as parsed at ingestion (full extracted text). */
  attachments: Attachment[];
}

export function ExtractionCard({ extraction, attachments }: Props) {
  const { summary, key_facts: facts, attachments: summarized } = extraction.result;
  const groups = groupFacts(facts);
  const summaries = new Map(summarized.map((a) => [a.filename, a.summary]));
  // Union: ingestion attachments plus any the extractor mentioned that ingestion didn't list.
  const names = [...new Set([...attachments.map((a) => a.filename), ...summarized.map((a) => a.filename)])];

  return (
    <Card
      title="Extraction"
      aside={<ProviderLabel provider={extraction.provider} model={extraction.model} />}
    >
      <div className={d.section}>
        <h4 className={`eyebrow ${d.label}`}>Summary</h4>
        <p className={d.prose}>{summary}</p>
      </div>

      <div className={d.section}>
        <h4 className={`eyebrow ${d.label}`}>Key facts</h4>
        {groups.length === 0 ? (
          <p className={d.muted}>No key facts extracted.</p>
        ) : (
          <div className={styles.facts}>
            {groups.map(([type, items]) => {
              const meta = factMeta(type);
              return (
                <section key={type} aria-label={meta.label} className={`${d.box} ${styles.group}`}>
                  <p className={styles.groupTitle}>
                    <Icon name={meta.icon} size={14} />
                    {meta.label}
                    <span className="count">{items.length}</span>
                  </p>
                  <ul className={styles.factList}>
                    {items.map((fact, i) => (
                      <li key={`${fact.value}-${i}`}>
                        <span className={styles.value}>{fact.value}</span>
                        {fact.context ? <span className={styles.context}>{fact.context}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {names.length ? (
        <div className={d.section}>
          <h4 className={`eyebrow ${d.label}`}>Attachments</h4>
          <ul className={d.stack}>
            {names.map((name) => {
              const full = attachments.find((a) => a.filename === name)?.extracted_text;
              return (
                <li key={name} className={`${d.box} ${styles.attachment}`}>
                  <p className={styles.filename}>
                    <Icon name="paperclip" />
                    <span>{name}</span>
                  </p>
                  {summaries.get(name) ? <p className={styles.attSummary}>{summaries.get(name)}</p> : null}
                  {full ? (
                    <details className={d.disclosure}>
                      <summary>
                        <Icon name="chevronRight" size={14} />
                        Extracted text
                      </summary>
                      <pre className={d.pre}>{full}</pre>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
