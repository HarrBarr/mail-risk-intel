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

import styles from "./GraphPage.module.css";

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
    <div className={styles.page}>
      <section aria-labelledby="graph-heading" className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.titles}>
            <h1 id="graph-heading" className={styles.heading}>
              Knowledge <span className="gradient-text">graph</span>
            </h1>
            <p className={styles.summary} aria-live="polite">
              {graph
                ? `${pluralize(graph.nodes.length, "entity", "entities")} · ${pluralize(graph.edges.length, "relationship")} across all processed emails`
                : "Entities and relationships across all processed emails"}
              {query.isFetching && graph ? (
                <span className={styles.fetching}>
                  <Spinner size={12} />
                </span>
              ) : null}
            </p>
          </div>
          <MinRiskFilter value={minRisk} onChange={setMinRisk} />
        </div>

        <div className={styles.stage} ref={canvasRef}>
          {query.isPending ? (
            <div role="status" className={styles.loading}>
              <Spinner size={20} /> Building graph…
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
              <div className={styles.canvas} aria-hidden="true">
                <GraphCanvas
                  graph={graph}
                  width={size.width}
                  height={size.height}
                  selectedId={selectedId}
                  focusToken={focusToken}
                  onSelect={setSelectedId}
                />
              </div>
              <div className={styles.legend}>
                <GraphLegend types={types} />
              </div>
              <p className={styles.hint}>Scroll to zoom · drag to pan · click a node</p>
            </>
          ) : null}
        </div>
      </section>

      {graph && !empty ? (
        <aside
          aria-label={selected ? `Details for ${selected.name}` : "Entity list"}
          className={styles.panel}
          data-open={selected ? "true" : "false"}
        >
          {selected ? (
            <>
              <div className={styles.grabber} aria-hidden="true" />
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
