import type { Graph, GraphEdge, GraphNode } from "@/api/schemas";

export const NODE_REL_SIZE = 4;

/** Node area grows with mention count; sqrt keeps hubs from swamping the canvas. */
export function nodeVal(node: GraphNode): number {
  return 1 + Math.min(node.mention_count, 12) * 1.5;
}

export function nodeRadius(node: GraphNode): number {
  return Math.sqrt(nodeVal(node)) * NODE_REL_SIZE;
}

export interface Connection {
  edge: GraphEdge;
  other: GraphNode;
}

export interface NodeConnections {
  outgoing: Connection[];
  incoming: Connection[];
}

export function connectionsOf(graph: Graph, nodeId: number): NodeConnections {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing: Connection[] = [];
  const incoming: Connection[] = [];
  for (const edge of graph.edges) {
    if (edge.source === nodeId) {
      const other = byId.get(edge.target);
      if (other) outgoing.push({ edge, other });
    } else if (edge.target === nodeId) {
      const other = byId.get(edge.source);
      if (other) incoming.push({ edge, other });
    }
  }
  return { outgoing, incoming };
}

export function neighbourIds(graph: Graph, nodeId: number): Set<number> {
  const ids = new Set<number>([nodeId]);
  for (const edge of graph.edges) {
    if (edge.source === nodeId) ids.add(edge.target);
    if (edge.target === nodeId) ids.add(edge.source);
  }
  return ids;
}

export function truncate(text: string, max = 22): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
