import type { IconName } from "@/components/Icon";

const FACT_ORDER = ["amount", "account", "reference", "date", "url", "attachment", "other"] as const;

const FACT_META: Record<string, { label: string; icon: IconName }> = {
  amount: { label: "Amounts", icon: "currency" },
  account: { label: "Accounts", icon: "card" },
  reference: { label: "References", icon: "tag" },
  date: { label: "Dates", icon: "clock" },
  url: { label: "Links", icon: "code" },
  attachment: { label: "Attachments", icon: "paperclip" },
  other: { label: "Other", icon: "info" },
};

export function factMeta(type: string) {
  return FACT_META[type] ?? FACT_META.other!;
}

export function groupFacts<T extends { type: string }>(facts: readonly T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const fact of facts) {
    const key = type(fact.type);
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  return [...groups.entries()].sort(
    ([a], [b]) => FACT_ORDER.indexOf(a as never) - FACT_ORDER.indexOf(b as never),
  );
}

function type(t: string): string {
  return (FACT_ORDER as readonly string[]).includes(t) ? t : "other";
}
