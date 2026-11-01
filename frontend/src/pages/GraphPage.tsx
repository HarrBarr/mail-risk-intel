import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useGraph } from "@/api/hooks";
import { levelSchema, type Level } from "@/api/schemas";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { EntityIndex } from "@/components/graph/EntityIndex";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { GraphLegend } from "@/components/graph/GraphLegend";
import { MinRiskFilter } from "@/components/graph/MinRiskFilter";
import { NodePanel } from "@/components/graph/NodePanel";
import { Spinner } from "@/components/Spinner";
import { pluralize } from "@/lib/format";
import { useElementSize } from "@/lib/useElementSize";

export default function GraphPage() {
  const [params, setParams] = useSearchParams();
  const parsed = levelSchema.safeParse(params.get("min_risk"));
  const minRisk: Level | undefined = parsed.success && parsed.data !== "none" ? parsed.data : undefined;
  const query = useGraph(minRisk);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [canvasRef, size] = useElementSize<HTMLDivElement>();

  const graph = query.data;
  const selected = useMemo(() => graph?.nodes.find((n) => n.id === selectedId) ?? null, [graph, selectedId]);
  const types = useMemo(() => [...new Set(graph?.nodes.map((n) => n.type) ?? [])], [graph]);

  // A filter change can remove the selected node.
  useEffect(() => {
    if (graph && selectedId !== null && !graph.nodes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [graph, selectedId]);

  const close = useCallback(() => setSelectedId(null), []);
  useEffect(() => {
    if (selectedId === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, close]);

  /** Select from a list (index / connections): also move the camera there. */
  const focusNode = (id: number) => {
    setSelectedId(id);
    setFocusToken((t) => t + 1);
  };

  const setMinRisk = (value: Level | undefined) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("min_risk", value);
        else next.delete("min_risk");
        return next;
      },
      { replace: true },
    );

  const empty = graph && graph.nodes.length === 0;

  return (
    <div className="mx-auto flex h-full max-w-screen-2xl">
      <section aria-labelledby="graph-heading" className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <h1 id="graph-heading" className="text-lg font-semibold text-slate-900">
              Knowledge graph
            </h1>
            <p className="text-xs text-slate-500" aria-live="polite">
              {graph
                ? `${pluralize(graph.nodes.length, "entity", "entities")} · ${pluralize(graph.edges.length, "relationship")} across all processed emails`
                : "Entities and relationships across all processed emails"}
              {query.isFetching && graph ? <Spinner className="ml-1.5 inline h-3 w-3" /> : null}
            </p>
          </div>
          <MinRiskFilter value={minRisk} onChange={setMinRisk} />
        </div>

        <div className="relative min-h-0 flex-1 bg-slate-50" ref={canvasRef}>
          {query.isPending ? (
            <div
              role="status"
              className="flex h-full items-center justify-center gap-2 text-sm text-slate-500"
            >
              <Spinner className="h-5 w-5" /> Building graph…
            </div>
          ) : query.isError && !graph ? (
            <ErrorState
              title="Couldn't load the graph"
              error={query.error}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          ) : empty ? (
            <EmptyState icon="graph" title={minRisk ? "No entities at this risk level" : "No entities yet"}>
              {minRisk
                ? "Lower the minimum risk to see more of the graph."
                : "Entities appear here once emails have been processed."}
            </EmptyState>
          ) : graph && size.width > 0 && size.height > 0 ? (
            <>
              <div className="absolute inset-0" aria-hidden="true">
                <GraphCanvas
                  graph={graph}
                  width={size.width}
                  height={size.height}
                  selectedId={selectedId}
                  focusToken={focusToken}
                  onSelect={setSelectedId}
                />
              </div>
              <div className="pointer-events-none absolute left-3 top-3 max-w-[16rem] [&>*]:pointer-events-auto">
                <GraphLegend types={types} />
              </div>
              <p className="pointer-events-none absolute bottom-3 right-3 hidden rounded bg-white/80 px-2 py-1 text-xs text-slate-500 sm:block">
                Scroll to zoom · drag to pan · click a node
              </p>
            </>
          ) : null}
        </div>
      </section>

      {graph && !empty ? (
        <aside
          aria-label={selected ? `Details for ${selected.name}` : "Entity list"}
          className={`${
            selected
              ? "fixed inset-x-0 bottom-0 z-30 max-h-[65dvh] animate-slide-up rounded-t-2xl border-t border-slate-200 shadow-2xl"
              : "hidden"
          } overflow-y-auto bg-white md:static md:block md:max-h-none md:w-80 md:shrink-0 md:animate-none md:rounded-none md:border-l md:border-t-0 md:shadow-none lg:w-96`}
        >
          {selected ? (
            <>
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 md:hidden" aria-hidden="true" />
              <NodePanel graph={graph} node={selected} onSelect={focusNode} onClose={close} />
            </>
          ) : (
            <EntityIndex nodes={graph.nodes} onSelect={focusNode} />
          )}
        </aside>
      ) : null}
    </div>
  );
}
