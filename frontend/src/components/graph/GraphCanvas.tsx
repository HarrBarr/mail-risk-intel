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

const LABEL_FONT = '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif';

/* Canvas can't read CSS variables cheaply per frame, so mirror the tokens here. */
const C = {
  bg: "#05060F",
  text: "#F5F7FF",
  muted: "#B3BAD6",
  aur1: "#6A5CFF",
  edge: "rgba(245,247,255,0.25)",
  edgeActive: "rgba(245,247,255,0.7)",
  edgeDim: "rgba(245,247,255,0.06)",
  halo: "rgba(5,6,15,0.85)",
  pill: "rgba(14,17,38,0.92)",
  pillBorder: "rgba(106,92,255,0.55)",
};

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
    ctx.globalAlpha = dim ? 0.16 : 1;

    // Risk ring (outside), a dark gap, then the entity fill — so "what" and "how risky" never blur.
    if (node.id === selectedId) {
      ctx.save();
      ctx.shadowColor = C.aur1;
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, 2 * Math.PI);
      ctx.lineWidth = 2 / scale;
      ctx.strokeStyle = C.text;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(x, y, r + 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = RISK_META[node.max_risk].hex;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r + 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = C.bg;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = entityMeta(node.type).hex;
    ctx.fill();

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
      const ty = y + r + 5;
      ctx.lineWidth = 3 / scale;
      ctx.lineJoin = "round";
      ctx.strokeStyle = C.halo;
      ctx.strokeText(label, x, ty);
      ctx.fillStyle = node.id === selectedId ? C.text : C.muted;
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
    const padX = 4 / scale;
    const padY = 1.5 / scale;
    ctx.beginPath();
    ctx.roundRect(mx - w / 2 - padX, my - fontSize / 2 - padY, w + padX * 2, fontSize + padY * 2, fontSize);
    ctx.fillStyle = C.pill;
    ctx.fill();
    ctx.lineWidth = 0.75 / scale;
    ctx.strokeStyle = C.pillBorder;
    ctx.stroke();
    ctx.fillStyle = C.text;
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
      linkColor={(l) => (linkActive(l) ? (selectedId !== null ? C.edgeActive : C.edge) : C.edgeDim)}
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
