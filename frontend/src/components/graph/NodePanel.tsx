import { Fragment } from "react";
import { Link } from "react-router-dom";

import type { Graph, GraphNode } from "@/api/schemas";
import { entityMeta } from "@/lib/entities";
import { formatPercent, humanize, pluralize } from "@/lib/format";
import { connectionsOf, type Connection } from "@/lib/graph";

import { EntityIcon } from "../EntityIcon";
import { Icon } from "../Icon";
import { RiskBadge } from "../RiskBadge";
import styles from "./NodePanel.module.css";

interface Props {
  graph: Graph;
  node: GraphNode;
  onSelect: (id: number) => void;
  onClose: () => void;
}

function ConnectionList({
  title,
  items,
  direction,
  onSelect,
}: {
  title: string;
  items: Connection[];
  direction: "out" | "in";
  onSelect: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className={styles.section}>
      <h4 className={`eyebrow ${styles.sectionTitle}`}>
        {title}
        <span className="count">{items.length}</span>
      </h4>
      <ul className={styles.connections}>
        {items.map(({ edge, other }, i) => (
          <li key={`${other.id}-${edge.type}-${i}`}>
            <button type="button" onClick={() => onSelect(other.id)} className={styles.connection}>
              <EntityIcon type={other.type} size="sm" />
              <span className={styles.connectionText}>
                <span className={styles.edge}>
                  {direction === "out" ? "" : "← "}
                  {humanize(edge.type)}
                  {direction === "out" ? " →" : ""} · {formatPercent(edge.confidence)}
                </span>
                <span className={styles.otherName}>{other.name}</span>
                <span className={styles.otherType}>{entityMeta(other.type).label}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NodePanel({ graph, node, onSelect, onClose }: Props) {
  const meta = entityMeta(node.type);
  const { outgoing, incoming } = connectionsOf(graph, node.id);
  const attrs = Object.entries(node.attributes).filter(([, v]) => v !== "" && v !== null && v !== node.name);

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <EntityIcon type={node.type} size="lg" />
        <div className={styles.headText}>
          <p className="eyebrow">{meta.label}</p>
          <h3 className={styles.name}>{node.name}</h3>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close entity details">
          <Icon name="x" size={20} />
        </button>
      </div>

      <div className={styles.stats}>
        <RiskBadge level={node.max_risk} />
        <span>{pluralize(node.mention_count, "mention")}</span>
      </div>

      {attrs.length ? (
        <dl className={styles.attrs}>
          {attrs.map(([k, v]) => (
            <Fragment key={k}>
              <dt>{humanize(k)}</dt>
              <dd>{String(v)}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}

      {outgoing.length + incoming.length === 0 ? (
        <p className={styles.none}>No connections at this risk filter.</p>
      ) : null}
      <ConnectionList title="Outgoing" items={outgoing} direction="out" onSelect={onSelect} />
      <ConnectionList title="Incoming" items={incoming} direction="in" onSelect={onSelect} />

      <section aria-label="Appears in" className={styles.section}>
        <h4 className={`eyebrow ${styles.sectionTitle}`}>
          Appears in
          <span className="count">{node.email_ids.length}</span>
        </h4>
        <ul className={styles.emails}>
          {node.email_ids.map((id) => (
            <li key={id}>
              <Link to={`/emails/${encodeURIComponent(id)}`} className={styles.emailLink}>
                <Icon name="mail" size={14} />
                {id}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
