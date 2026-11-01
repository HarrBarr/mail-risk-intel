import type { Entity, Relationship } from "@/api/schemas";
import { entityMeta, groupByType } from "@/lib/entities";
import { formatPercent, humanize } from "@/lib/format";

import { Card } from "../Card";
import { EmptyState } from "../EmptyState";
import { EntityIcon } from "../EntityIcon";
import { Icon } from "../Icon";
import d from "./Detail.module.css";
import styles from "./EntitiesPanel.module.css";

function attributeText(attributes: Record<string, unknown>): string | null {
  const parts = Object.entries(attributes)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${humanize(k)}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length ? parts.join(" · ") : null;
}

function EntityGroups({ entities }: { entities: Entity[] }) {
  return (
    <div className={styles.groups}>
      {groupByType(entities).map(([type, items]) => {
        const meta = entityMeta(type);
        return (
          <section key={type} aria-label={meta.plural}>
            <h4 className={`eyebrow ${d.label}`}>
              {meta.plural}
              <span className="count">{items.length}</span>
            </h4>
            <ul className={styles.entities}>
              {items.map((entity) => {
                const attrs = attributeText(entity.attributes);
                // Hide the attribute line when it just repeats the name (e.g. email == name).
                const showAttrs = attrs && !Object.values(entity.attributes).every((v) => v === entity.name);
                return (
                  <li key={entity.id} className={styles.entity}>
                    <EntityIcon type={entity.type} />
                    <div className={styles.entityText}>
                      <p className={styles.name}>{entity.name}</p>
                      {showAttrs ? <p className={styles.attrs}>{attrs}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Relationships({ relationships }: { relationships: Relationship[] }) {
  return (
    <ul className={d.stack}>
      {relationships.map((rel) => (
        <li key={rel.id} className={`${d.box} ${styles.rel}`}>
          <span className={styles.end}>{rel.source}</span>
          <span className={styles.edge}>
            <span aria-hidden="true">—</span>
            <span className={styles.type}>{humanize(rel.type)}</span>
            <Icon name="arrowRight" size={14} />
          </span>
          <span className={styles.end}>{rel.target}</span>
          <span className={styles.confidence} title="Confidence">
            {formatPercent(rel.confidence)}
            <span className="sr-only"> confidence</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EntitiesPanel({
  entities,
  relationships,
}: {
  entities: Entity[];
  relationships: Relationship[];
}) {
  if (entities.length === 0 && relationships.length === 0) {
    return (
      <Card title="Entities & relationships">
        <EmptyState icon="graph" title="No entities found" compact>
          Nothing in this email was recognised as a person, organization, amount or account.
        </EmptyState>
      </Card>
    );
  }
  return (
    <Card
      title="Entities & relationships"
      aside={`${entities.length} entities · ${relationships.length} links`}
    >
      <div className={styles.layout}>
        <EntityGroups entities={entities} />
        <section aria-label="Relationships">
          <h4 className={`eyebrow ${d.label}`}>Relationships</h4>
          {relationships.length ? (
            <Relationships relationships={relationships} />
          ) : (
            <p className={d.muted}>No relationships between these entities.</p>
          )}
        </section>
      </div>
    </Card>
  );
}
