import { describe, expect, it } from 'vitest';
import { filterGraphBySearch, type GraphData } from './graphFilter';

interface TestNode {
  id: string;
  filePath: string | null;
}

interface TestEdge {
  source: string;
  target: string;
}

function makeGraph(
  nodes: TestNode[],
  edges: TestEdge[],
): GraphData<TestNode, TestEdge> {
  return { nodes, edges };
}

describe('filterGraphBySearch', () => {
  it('returns graph unchanged when matchedFilePaths is null', () => {
    const graph = makeGraph(
      [{ id: 'a.md', filePath: 'a.md' }],
      [],
    );
    const result = filterGraphBySearch(graph, null);
    expect(result).toBe(graph);
  });

  it('returns null when graph is null', () => {
    const result = filterGraphBySearch(null, new Set(['a.md']));
    expect(result).toBeNull();
  });

  it('keeps nodes with matching filePaths', () => {
    const graph = makeGraph(
      [
        { id: 'a.md', filePath: 'a.md' },
        { id: 'b.md', filePath: 'b.md' },
      ],
      [],
    );
    const result = filterGraphBySearch(graph, new Set(['a.md']));
    expect(result?.nodes).toHaveLength(1);
    expect(result?.nodes[0].id).toBe('a.md');
  });

  it('removes nodes without matching filePaths', () => {
    const graph = makeGraph(
      [
        { id: 'a.md', filePath: 'a.md' },
        { id: 'b.md', filePath: 'b.md' },
      ],
      [],
    );
    const result = filterGraphBySearch(graph, new Set(['a.md']));
    const ids = result?.nodes.map((n) => n.id);
    expect(ids).not.toContain('b.md');
  });

  it('keeps edges where both endpoints match', () => {
    const graph = makeGraph(
      [
        { id: 'a.md', filePath: 'a.md' },
        { id: 'b.md', filePath: 'b.md' },
      ],
      [{ source: 'a.md', target: 'b.md' }],
    );
    const result = filterGraphBySearch(graph, new Set(['a.md', 'b.md']));
    expect(result?.edges).toHaveLength(1);
    expect(result?.edges[0]).toEqual({ source: 'a.md', target: 'b.md' });
  });

  it('removes edges where either endpoint does not match', () => {
    const graph = makeGraph(
      [
        { id: 'a.md', filePath: 'a.md' },
        { id: 'b.md', filePath: 'b.md' },
        { id: 'c.md', filePath: 'c.md' },
      ],
      [
        { source: 'a.md', target: 'b.md' },
        { source: 'b.md', target: 'c.md' },
      ],
    );
    const result = filterGraphBySearch(graph, new Set(['a.md', 'b.md']));
    expect(result?.edges).toHaveLength(1);
    expect(result?.edges[0]).toEqual({ source: 'a.md', target: 'b.md' });
  });

  it('returns empty graph when matchedFilePaths is an empty Set', () => {
    const graph = makeGraph(
      [
        { id: 'a.md', filePath: 'a.md' },
        { id: 'b.md', filePath: 'b.md' },
      ],
      [{ source: 'a.md', target: 'b.md' }],
    );
    const result = filterGraphBySearch(graph, new Set());
    expect(result?.nodes).toHaveLength(0);
    expect(result?.edges).toHaveLength(0);
  });
});
