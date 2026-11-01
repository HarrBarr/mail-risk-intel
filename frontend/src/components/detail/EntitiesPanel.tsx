import type { Entity, Relationship } from "@/api/schemas";
import { entityMeta, groupByType } from "@/lib/entities";
import { formatPercent, humanize } from "@/lib/format";

import { Card } from "../Card";
import { EmptyState } from "../EmptyState";
import { Icon } from "../Icon";

function attributeText(attributes: Record<string, unknown>): string | null {
  const parts = Object.entries(attributes)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${humanize(k)}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length ? parts.join(" · ") : null;
}

function EntityGroups({ entities }: { entities: Entity[] }) {
  return (
    <div className="space-y-4">
      {groupByType(entities).map(([type, items]) => {
        const meta = entityMeta(type);
        return (
          <section key={type} aria-label={meta.plural}>
            <h4 className="eyebrow flex items-center gap-1.5">
              {meta.plural} <span className="font-normal normal-case text-slate-400">{items.length}</span>
            </h4>
            <ul className="mt-1.5 space-y-1.5">
              {items.map((entity) => {
                const attrs = attributeText(entity.attributes);
                // Hide the attribute line when it just repeats the name (e.g. email == name).
                const showAttrs = attrs && !Object.values(entity.attributes).every((v) => v === entity.name);
                return (
                  <li key={entity.id} className="flex items-start gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.tile}`}
                    >
                      <Icon name={meta.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="break-words text-sm font-medium text-slate-900">{entity.name}</p>
                      {showAttrs ? <p className="break-words text-xs text-slate-500">{attrs}</p> : null}
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
    <ul className="space-y-2">
      {relationships.map((rel) => (
        <li
          key={rel.id}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
        >
          <span className="min-w-0 break-all font-medium text-slate-900">{rel.source}</span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            <span aria-hidden="true">—</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">
              {humanize(rel.type)}
            </span>
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 break-all font-medium text-slate-900">{rel.target}</span>
          <span className="ml-auto text-xs text-slate-500" title="Confidence">
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
      <div className="grid gap-6 lg:grid-cols-2">
        <EntityGroups entities={entities} />
        <section aria-label="Relationships">
          <h4 className="eyebrow">Relationships</h4>
          <div className="mt-1.5">
            {relationships.length ? (
              <Relationships relationships={relationships} />
            ) : (
              <p className="text-sm text-slate-500">No relationships between these entities.</p>
            )}
          </div>
        </section>
      </div>
    </Card>
  );
}
