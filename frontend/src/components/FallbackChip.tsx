import { Chip } from "./Chip";

export function FallbackChip() {
  return (
    <Chip title="Assessed by the rule-based fallback, not an LLM" dotColor="var(--c-warn)">
      fallback
    </Chip>
  );
}
