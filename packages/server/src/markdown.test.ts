import { describe, expect, it } from 'vitest';
import {
  buildProjectGraphFromFiles,
  searchProjectFiles,
  type MarkdownFileRecord,
} from './markdown.js';

describe('buildProjectGraphFromFiles', () => {
  it('builds edges from wiki-links and markdown links and keeps dangling wiki targets', () => {
    const files: MarkdownFileRecord[] = [
      {
        path: 'index.md',
        content: 'See [[Guide]] and [Guide](docs/guide.md) and [[Missing Note]].',
      },
      {
        path: 'docs/guide.md',
        content: 'Back to [[Index]].',
      },
    ];

    const graph = buildProjectGraphFromFiles(files);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'index.md', dangling: false }),
        expect.objectContaining({ id: 'docs/guide.md', dangling: false }),
        expect.objectContaining({
          id: 'dangling:missing note',
          label: 'Missing Note',
          dangling: true,
        }),
      ]),
    );

    expect(graph.edges).toEqual(
      expect.arrayContaining([
          expect.objectContaining({
            source: 'index.md',
            target: 'docs/guide.md',
            kind: 'markdown',
          }),
        expect.objectContaining({
          source: 'index.md',
          target: 'dangling:missing note',
          kind: 'wiki',
        }),
        expect.objectContaining({
          source: 'docs/guide.md',
          target: 'index.md',
          kind: 'wiki',
        }),
      ]),
    );
  });
});

describe('searchProjectFiles', () => {
  it('returns content matches ranked by match count', () => {
    const files: MarkdownFileRecord[] = [
      {
        path: 'a.md',
        content: 'alpha beta alpha',
      },
      {
        path: 'b.md',
        content: 'beta only once',
      },
      {
        path: 'c.md',
        content: 'no match here',
      },
    ];

    const results = searchProjectFiles(files, 'alpha');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        filePath: 'a.md',
        matchCount: 2,
      }),
    );
    expect(results[0].preview).toContain('alpha beta alpha');
  });

  it('returns results sorted by matchCount descending', () => {
    const files: MarkdownFileRecord[] = [
      {
        path: 'once.md',
        content: 'beta appears once here',
      },
      {
        path: 'many.md',
        content: 'beta beta beta beta',
      },
      {
        path: 'twice.md',
        content: 'beta is here, and beta is there',
      },
    ];

    const results = searchProjectFiles(files, 'beta');

    expect(results).toHaveLength(3);
    expect(results[0].filePath).toBe('many.md');
    expect(results[0].matchCount).toBe(4);
    expect(results[1].filePath).toBe('twice.md');
    expect(results[1].matchCount).toBe(2);
    expect(results[2].filePath).toBe('once.md');
    expect(results[2].matchCount).toBe(1);
  });
});

describe('buildProjectGraphFromFiles — circular references', () => {
  it('handles circular wiki-link references without infinite loop', () => {
    const files: MarkdownFileRecord[] = [
      {
        path: 'a.md',
        content: '[[b]]',
      },
      {
        path: 'b.md',
        content: '[[a]]',
      },
    ];

    const graph = buildProjectGraphFromFiles(files);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a.md', dangling: false }),
        expect.objectContaining({ id: 'b.md', dangling: false }),
      ]),
    );
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'a.md', target: 'b.md', kind: 'wiki' }),
        expect.objectContaining({ source: 'b.md', target: 'a.md', kind: 'wiki' }),
      ]),
    );
  });
});
