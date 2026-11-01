import { forceX, forceY } from "d3-force";
import { useEffect, useMemo, useRef } from "react";
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from "react-force-graph-2d";

import type { Graph, GraphEdge, GraphNode } from "@/api/schemas";
import { entityMeta } from "@/lib/entities";
import { humanize } from "@/lib/format";
import { NODE_REL_SIZE, neighbourIds, nodeRadius, nodeVal, truncate } from "@/lib/graph";
import { RISK_META } from "@/lib/risk";

type Node = NodeObject<GraphNode>;
type Link = LinkObject<GraphNode, Omit<GraphEdge, "source" | "target">>;

interface Props {
  graph: Graph;
  width: number;
  height: number;
  selectedId: number | null;
  /** Bumped by the parent to ask the canvas to center on the selected node. */
  focusToken: number;
  onSelect: (id: number | null) => void;
}

const LABEL_FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

export function GraphCanvas({ graph, width, height, selectedId, focusToken, onSelect }: Props) {
  const fgRef = useRef<ForceGraphMethods<Node, Link>>();
  const fitted = useRef(false);

  // force-graph mutates its input (adds x/y, swaps link ends for node objects): give it a copy.
  const data = useMemo(
    () => ({
      nodes: graph.nodes.map((n) => ({ ...n })) as Node[],
      links: graph.edges.map((e) => ({ ...e })) as Link[],
    }),
    [graph],
  );

  const highlight = useMemo(
    () => (selectedId === null ? null : neighbourIds(graph, selectedId)),
    [graph, selectedId],
  );

  useEffect(() => {
    fitted.current = false;
    // Spread nodes a little more than the default so labels have room.
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength?.(-90);
    fg.d3Force("link")?.distance?.(45);
    // Gentle pull to the centre so disconnected clusters don't drift off and shrink the fit.
    fg.d3Force("x", forceX(0).strength(0.06));
    fg.d3Force("y", forceY(0).strength(0.06));
  }, [data]);

  useEffect(() => {
    if (selectedId === null || focusToken === 0) return;
    const node = data.nodes.find((n) => n.id === selectedId);
    if (node?.x !== undefined && node.y !== undefined) {
      fgRef.current?.centerAt(node.x, node.y, 500);
      fgRef.current?.zoom(Math.max(fgRef.current.zoom(), 2.5), 500);
    }
    // focusToken is the trigger; selectedId alone (canvas clicks) shouldn't move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  const isDim = (id: number) => highlight !== null && !highlight.has(id);

  const drawNode = (node: Node, ctx: CanvasRenderingContext2D, scale: number) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = nodeRadius(node);
    const dim = isDim(node.id);
    ctx.globalAlpha = dim ? 0.18 : 1;

    // Risk ring (outside), then entity fill.
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, 2 * Math.PI);
    ctx.fillStyle = RISK_META[node.max_risk].hex;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = entityMeta(node.type).hex;
    ctx.fill();
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    if (node.id === selectedId) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, 2 * Math.PI);
      ctx.lineWidth = 2 / scale;
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();
    }

    // Labels: always for the selection and its neighbours, otherwise once zoomed in enough.
    const showLabel =
      node.id === selectedId ||
      (highlight?.has(node.id) ?? false) ||
      scale > 1.6 ||
      (highlight === null && node.mention_count > 2);
    if (showLabel && !dim) {
      const fontSize = Math.max(11 / scale, 2.5);
      ctx.font = `${node.id === selectedId ? "600" : "500"} ${fontSize}px ${LABEL_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = truncate(node.name);
      const ty = y + r + 3;
      ctx.lineWidth = 3 / scale;
      ctx.strokeStyle = "rgba(248,250,252,0.95)";
      ctx.strokeText(label, x, ty);
      ctx.fillStyle = "#0f172a";
      ctx.fillText(label, x, ty);
    }
    ctx.globalAlpha = 1;
  };

  const paintPointerArea = (node: Node, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius(node) + 4, 0, 2 * Math.PI);
    ctx.fill();
  };

  const endId = (end: Link["source"]) => (typeof end === "object" ? (end as Node).id : (end as number));
  const linkActive = (link: Link) =>
    highlight === null || endId(link.source) === selectedId || endId(link.target) === selectedId;

  const drawLinkLabel = (link: Link, ctx: CanvasRenderingContext2D, scale: number) => {
    const src = link.source as Node;
    const tgt = link.target as Node;
    if (typeof src !== "object" || typeof tgt !== "object") return;
    const active = selectedId !== null && linkActive(link);
    if (selectedId !== null && !active) return; // only the selection's edges are labelled
    if (!active && scale < 2.2) return; // keep the overview uncluttered
    const mx = ((src.x ?? 0) + (tgt.x ?? 0)) / 2;
    const my = ((src.y ?? 0) + (tgt.y ?? 0)) / 2;
    const fontSize = Math.max(9 / scale, 2);
    ctx.font = `500 ${fontSize}px ${LABEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = humanize(link.type as string);
    const w = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(mx - w / 2 - 2 / scale, my - fontSize / 2 - 1 / scale, w + 4 / scale, fontSize + 2 / scale);
    ctx.fillStyle = "#334155";
    ctx.fillText(text, mx, my);
  };

  return (
    <ForceGraph2D<GraphNode, Omit<GraphEdge, "source" | "target">>
      ref={fgRef}
      graphData={data}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      nodeRelSize={NODE_REL_SIZE}
      nodeVal={(n) => nodeVal(n as GraphNode)}
      nodeLabel={(n) => `${n.name} (${entityMeta(n.type).label.toLowerCase()})`}
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={paintPointerArea}
      linkColor={(l) =>
        linkActive(l) ? (selectedId !== null ? "#475569" : "#94a3b8") : "rgba(148,163,184,0.15)"
      }
      linkWidth={(l) => (selectedId !== null && linkActive(l) ? 1.6 : 1)}
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={1}
      linkLabel={(l) => `${humanize(l.type as string)} · ${Math.round((l.confidence as number) * 100)}%`}
      linkCanvasObjectMode={() => "after"}
      linkCanvasObject={drawLinkLabel}
      onNodeClick={(n) => onSelect(n.id === selectedId ? null : (n.id as number))}
      onBackgroundClick={() => onSelect(null)}
      cooldownTicks={150}
      onEngineStop={() => {
        if (!fitted.current) {
          fitted.current = true;
          fgRef.current?.zoomToFit(400, 48);
        }
      }}
    />
  );
}
