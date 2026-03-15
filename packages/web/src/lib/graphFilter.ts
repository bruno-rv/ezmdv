export interface GraphData<N extends { id: string; filePath?: string | null }, E extends { source: string; target: string }> {
  nodes: N[];
  edges: E[];
}

export function filterGraphBySearch<
  N extends { id: string; filePath?: string | null },
  E extends { source: string; target: string },
>(graph: GraphData<N, E> | null, matchedFilePaths: Set<string> | null): GraphData<N, E> | null {
  if (!graph || !matchedFilePaths) return graph;
  const matchedIds = new Set(graph.nodes.filter(n => n.filePath && matchedFilePaths.has(n.filePath)).map(n => n.id));
  const edges = graph.edges.filter(e => matchedIds.has(e.source) && matchedIds.has(e.target));
  const nodes = graph.nodes.filter(n => matchedIds.has(n.id));
  return { nodes, edges };
}
