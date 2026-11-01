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
  /** Hex fill for graph nodes; also the icon tint in the DOM. */
  hex: string;
}

/*
 * Entity fills come from the brand palette (violet / cyan / mint / warm amber …). Pink is
 * avoided for fills because it reads as the 'high' ring, which most nodes carry. Some share a
 * hue family with a risk ring, so the graph always draws a dark gap between the fill
 * (what it is) and the ring (how risky): the ring reads as a separate outline. Each hex
 * is >= 3:1 against --c-bg, so icons drawn in it pass non-text contrast.
 */
export const ENTITY_META: Record<EntityType, EntityMeta> = {
  person: {
    label: "Person",
    plural: "People",
    icon: "user",
    hex: "#6A5CFF",
  },
  organization: {
    label: "Organization",
    plural: "Organizations",
    icon: "building",
    hex: "#2FD5FF",
  },
  amount: {
    label: "Amount",
    plural: "Amounts",
    icon: "currency",
    hex: "#7CF2C8",
  },
  account: {
    label: "Account",
    plural: "Accounts",
    icon: "card",
    hex: "#FFC48A",
  },
  location: {
    label: "Location",
    plural: "Locations",
    icon: "pin",
    hex: "#C7B8FF",
  },
  document: {
    label: "Document",
    plural: "Documents",
    icon: "file",
    hex: "#B3BAD6",
  },
  other: {
    label: "Other",
    plural: "Other",
    icon: "tag",
    hex: "#7A83A6",
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
