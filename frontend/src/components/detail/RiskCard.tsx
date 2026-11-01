import type { Risk } from "@/api/schemas";
import { humanize } from "@/lib/format";
import { RISK_META, isFallbackProvider, splitRationale } from "@/lib/risk";

import { Card } from "../Card";
import { Chip } from "../Chip";
import { FallbackChip } from "../FallbackChip";
import { Icon } from "../Icon";
import { RiskBadge } from "../RiskBadge";
import { ProviderLabel } from "./ProviderLabel";

export function RiskCard({ risk }: { risk: Risk }) {
  const { text, raisedNote } = splitRationale(risk.rationale);
  return (
    <Card title="Risk" aside={<ProviderLabel provider={risk.provider} model={risk.model} />}>
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge level={risk.level} size="md" />
        <span className="text-sm text-slate-600">{RISK_META[risk.level].description}</span>
        {isFallbackProvider(risk.provider) ? <FallbackChip /> : null}
      </div>

      {raisedNote ? (
        <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <Icon name="shield" className="mt-0.5 h-4 w-4 text-amber-700" />
          <p>
            <span className="font-semibold">Safety floor applied.</span> The model's level was raised by
            deterministic checks:{" "}
            <span className="break-words">{raisedNote.replace(/^Raised from /, "from ")}</span>
          </p>
        </div>
      ) : null}

      <h4 className="eyebrow mt-4">Rationale</h4>
      <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-slate-800">{text}</p>

      {risk.tags.length ? (
        <>
          <h4 className="eyebrow mt-4">Tags</h4>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {risk.tags.map((tag) => (
              <li key={tag}>
                <Chip>{humanize(tag)}</Chip>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {risk.signals.length ? (
        <>
          <h4 className="eyebrow mt-4">Deterministic signals</h4>
          <ul className="mt-1.5 divide-y divide-slate-100 rounded-md border border-slate-200">
            {risk.signals.map((signal, i) => (
              <li key={`${signal.tag}-${i}`} className="flex items-start gap-3 px-3 py-2">
                <span
                  className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-700"
                  title="Signal weight"
                >
                  +{signal.weight}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{humanize(signal.tag)}</p>
                  <p className="break-words text-xs text-slate-600">{signal.evidence}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
