import { Chip } from "./Chip";

export function FallbackChip() {
  return (
    <Chip
      className="bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-300"
      title="Assessed by the rule-based fallback, not an LLM"
    >
      fallback
    </Chip>
  );
}
