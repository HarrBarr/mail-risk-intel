import { useMemo, useState } from "react";

import type { GraphNode } from "@/api/schemas";
import { entityMeta } from "@/lib/entities";
import { RISK_META, RISK_RANK } from "@/lib/risk";

import { EntityIcon } from "../EntityIcon";
import styles from "./EntityIndex.module.css";

/**
 * Keyboard/screen-reader route into the graph: every node as a button, riskiest and
 * most-mentioned first, with a filter box. Selecting one focuses it on the canvas.
 */
export function EntityIndex({ nodes, onSelect }: { nodes: GraphNode[]; onSelect: (id: number) => void }) {
  const [filter, setFilter] = useState("");
  const sorted = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return nodes
      .filter((n) => !f || n.name.toLowerCase().includes(f) || n.type.includes(f))
      .sort(
        (a, b) =>
          RISK_RANK[b.max_risk] - RISK_RANK[a.max_risk] ||
          b.mention_count - a.mention_count ||
          a.name.localeCompare(b.name),
      );
  }, [nodes, filter]);

  return (
    <div className={styles.index}>
      <h2 className={styles.title}>Entities</h2>
      <p className={styles.subtitle}>Click a node, or pick one here.</p>
      <label className="sr-only" htmlFor="entity-filter">
        Filter entities
      </label>
      <input
        id="entity-filter"
        type="search"
        className={`input ${styles.filter}`}
        placeholder="Filter entities…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className={styles.list}>
        {sorted.map((node) => (
          <li key={node.id}>
            <button type="button" onClick={() => onSelect(node.id)} className={styles.item}>
              <EntityIcon type={node.type} size="sm" />
              <span className={styles.name}>{node.name}</span>
              <span className="sr-only">
                , {entityMeta(node.type).label}, highest risk {node.max_risk}
              </span>
              <span
                className={styles.risk}
                style={{ color: RISK_META[node.max_risk].cssVar }}
                aria-hidden="true"
                title={`Highest risk: ${node.max_risk}`}
              />
              <span className={styles.mentions} aria-label={`${node.mention_count} mentions`}>
                {node.mention_count}
              </span>
            </button>
          </li>
        ))}
        {sorted.length === 0 ? <li className={styles.empty}>No entities match.</li> : null}
      </ul>
    </div>
  );
}
