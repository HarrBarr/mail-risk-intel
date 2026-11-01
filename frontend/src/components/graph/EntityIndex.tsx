import { useMemo, useState } from "react";

import type { GraphNode } from "@/api/schemas";
import { entityMeta } from "@/lib/entities";
import { RISK_RANK } from "@/lib/risk";

import { Icon } from "../Icon";

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
    <div className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">Entities</h2>
      <p className="mt-0.5 text-xs text-slate-500">Click a node, or pick one here.</p>
      <label className="sr-only" htmlFor="entity-filter">
        Filter entities
      </label>
      <input
        id="entity-filter"
        type="search"
        className="input mt-3"
        placeholder="Filter entities…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className="mt-2 space-y-0.5">
        {sorted.map((node) => {
          const meta = entityMeta(node.type);
          return (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onSelect(node.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${meta.tile}`}>
                  <Icon name={meta.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{node.name}</span>
                <span className="sr-only">
                  , {meta.label}, highest risk {node.max_risk}
                </span>
                <span className="text-xs text-slate-400" aria-label={`${node.mention_count} mentions`}>
                  {node.mention_count}
                </span>
              </button>
            </li>
          );
        })}
        {sorted.length === 0 ? (
          <li className="px-2 py-3 text-sm text-slate-500">No entities match.</li>
        ) : null}
      </ul>
    </div>
  );
}
