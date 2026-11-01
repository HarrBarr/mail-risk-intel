import type { IconName } from "@/components/Icon";

export const ENTITY_TYPES = [
  "person",
  "organization",
  "amount",
  "account",
  "location",
  "document",
  "other",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

interface EntityMeta {
  label: string;
  plural: string;
  icon: IconName;
  /** Tailwind classes for the icon tile / chip. */
  tile: string;
  /** Hex fill for graph nodes. */
  hex: string;
}

/*
 * Entity colors deliberately avoid the risk hues (emerald/sky/amber/red), so in the
 * graph a node's fill (what it is) never gets confused with its ring (how risky).
 */
export const ENTITY_META: Record<EntityType, EntityMeta> = {
  person: {
    label: "Person",
    plural: "People",
    icon: "user",
    tile: "bg-violet-100 text-violet-800",
    hex: "#7c3aed",
  },
  organization: {
    label: "Organization",
    plural: "Organizations",
    icon: "building",
    tile: "bg-indigo-100 text-indigo-800",
    hex: "#4f46e5",
  },
  amount: {
    label: "Amount",
    plural: "Amounts",
    icon: "currency",
    tile: "bg-teal-100 text-teal-800",
    hex: "#0f766e",
  },
  account: {
    label: "Account",
    plural: "Accounts",
    icon: "card",
    tile: "bg-fuchsia-100 text-fuchsia-800",
    hex: "#c026d3",
  },
  location: {
    label: "Location",
    plural: "Locations",
    icon: "pin",
    tile: "bg-cyan-100 text-cyan-800",
    hex: "#0e7490",
  },
  document: {
    label: "Document",
    plural: "Documents",
    icon: "file",
    tile: "bg-stone-200 text-stone-800",
    hex: "#78716c",
  },
  other: {
    label: "Other",
    plural: "Other",
    icon: "tag",
    tile: "bg-slate-200 text-slate-700",
    hex: "#64748b",
  },
};

export function entityMeta(type: string): EntityMeta {
  return (ENTITY_META as Record<string, EntityMeta | undefined>)[type] ?? ENTITY_META.other;
}

/** Group items by entity type in a stable, meaningful order (people first, unknown types last). */
export function groupByType<T extends { type: string }>(items: readonly T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const list = groups.get(item.type) ?? [];
    list.push(item);
    groups.set(item.type, list);
  }
  const order = (t: string) => {
    const i = (ENTITY_TYPES as readonly string[]).indexOf(t);
    return i === -1 ? ENTITY_TYPES.length : i;
  };
  return [...groups.entries()].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b));
}
