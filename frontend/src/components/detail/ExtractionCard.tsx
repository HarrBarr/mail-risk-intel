import type { Attachment, Extraction } from "@/api/schemas";
import { factMeta, groupFacts } from "@/lib/facts";

import { Card } from "../Card";
import { Icon } from "../Icon";
import { ProviderLabel } from "./ProviderLabel";

interface Props {
  extraction: Extraction;
  /** Attachments as parsed at ingestion (full extracted text). */
  attachments: Attachment[];
}

export function ExtractionCard({ extraction, attachments }: Props) {
  const { summary, key_facts: facts, attachments: summarized } = extraction.result;
  const groups = groupFacts(facts);
  const summaries = new Map(summarized.map((a) => [a.filename, a.summary]));
  // Union: ingestion attachments plus any the extractor mentioned that ingestion didn't list.
  const names = [...new Set([...attachments.map((a) => a.filename), ...summarized.map((a) => a.filename)])];

  return (
    <Card
      title="Extraction"
      aside={<ProviderLabel provider={extraction.provider} model={extraction.model} />}
    >
      <h4 className="eyebrow">Summary</h4>
      <p className="mt-1 break-words text-sm leading-relaxed text-slate-800">{summary}</p>

      <h4 className="eyebrow mt-4">Key facts</h4>
      {groups.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">No key facts extracted.</p>
      ) : (
        <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
          {groups.map(([type, items]) => {
            const meta = factMeta(type);
            return (
              <section
                key={type}
                aria-label={meta.label}
                className="rounded-md border border-slate-200 px-3 py-2"
              >
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Icon name={meta.icon} className="h-3.5 w-3.5" />
                  {meta.label}
                  <span className="font-normal text-slate-400">{items.length}</span>
                </p>
                <ul className="mt-1 space-y-1">
                  {items.map((fact, i) => (
                    <li key={`${fact.value}-${i}`} className="text-sm">
                      <span className="break-words font-medium text-slate-900">{fact.value}</span>
                      {fact.context ? (
                        <span className="block break-words text-xs text-slate-500">{fact.context}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {names.length ? (
        <>
          <h4 className="eyebrow mt-4">Attachments</h4>
          <ul className="mt-1.5 space-y-2">
            {names.map((name) => {
              const full = attachments.find((a) => a.filename === name)?.extracted_text;
              return (
                <li key={name} className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                    <Icon name="paperclip" className="h-4 w-4 text-slate-500" />
                    <span className="min-w-0 break-all">{name}</span>
                  </p>
                  {summaries.get(name) ? (
                    <p className="mt-1 break-words text-sm text-slate-700">{summaries.get(name)}</p>
                  ) : null}
                  {full ? (
                    <details className="group mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-indigo-700 hover:underline">
                        Extracted text
                      </summary>
                      <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 font-mono text-xs text-slate-700">
                        {full}
                      </pre>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
