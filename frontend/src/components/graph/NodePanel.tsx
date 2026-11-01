import { Link } from "react-router-dom";

import type { Graph, GraphNode } from "@/api/schemas";
import { entityMeta } from "@/lib/entities";
import { formatPercent, humanize, pluralize } from "@/lib/format";
import { connectionsOf, type Connection } from "@/lib/graph";

import { Icon } from "../Icon";
import { RiskBadge } from "../RiskBadge";

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
    <section aria-label={title} className="mt-4">
      <h4 className="eyebrow">
        {title} <span className="font-normal normal-case text-slate-400">{items.length}</span>
      </h4>
      <ul className="mt-1.5 space-y-1">
        {items.map(({ edge, other }, i) => {
          const meta = entityMeta(other.type);
          return (
            <li key={`${other.id}-${edge.type}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(other.id)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${meta.tile}`}
                >
                  <Icon name={meta.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-slate-500">
                    {direction === "out" ? "" : "← "}
                    {humanize(edge.type)}
                    {direction === "out" ? " →" : ""} · {formatPercent(edge.confidence)}
                  </span>
                  <span className="block break-words text-sm font-medium text-slate-900">{other.name}</span>
                  <span className="block text-xs text-slate-500">{meta.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function NodePanel({ graph, node, onSelect, onClose }: Props) {
  const meta = entityMeta(node.type);
  const { outgoing, incoming } = connectionsOf(graph, node.id);
  const attrs = Object.entries(node.attributes).filter(([, v]) => v !== "" && v !== null && v !== node.name);

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tile}`}>
          <Icon name={meta.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">{meta.label}</p>
          <h3 className="break-words text-base font-semibold text-slate-900">{node.name}</h3>
        </div>
        <button
          type="button"
          className="icon-btn -mr-2 -mt-1"
          onClick={onClose}
          aria-label="Close entity details"
        >
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <RiskBadge level={node.max_risk} />
        <span>{pluralize(node.mention_count, "mention")}</span>
      </div>

      {attrs.length ? (
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
          {attrs.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{humanize(k)}</dt>
              <dd className="break-words text-slate-800">{String(v)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {outgoing.length + incoming.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No connections at this risk filter.</p>
      ) : null}
      <ConnectionList title="Outgoing" items={outgoing} direction="out" onSelect={onSelect} />
      <ConnectionList title="Incoming" items={incoming} direction="in" onSelect={onSelect} />

      <section aria-label="Appears in" className="mt-4">
        <h4 className="eyebrow">
          Appears in <span className="font-normal normal-case text-slate-400">{node.email_ids.length}</span>
        </h4>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {node.email_ids.map((id) => (
            <li key={id}>
              <Link
                to={`/emails/${encodeURIComponent(id)}`}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 font-mono text-xs text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50"
              >
                <Icon name="mail" className="h-3.5 w-3.5" />
                {id}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
