import { describe, expect, it } from 'vitest';
import type { CompletionContext } from '@codemirror/autocomplete';
import { wikiLinkSource } from './wikiLinkCompletion';

function makeCtx(line: string, cursorInLine: number, explicit = false, suffix = '') {
  const from = 0;
  const pos = from + cursorInLine;
  return {
    state: {
      doc: {
        lineAt: (_pos: number) => ({ text: line, from }),
      },
      sliceDoc: (_from: number, _to: number) => suffix,
    },
    pos,
    explicit,
  } as unknown as CompletionContext;
}

describe('wikiLinkSource', () => {
  it('detects [[ context and returns completions', () => {
    const source = wikiLinkSource(['notes/foo.md', 'notes/bar.md']);
    const ctx = makeCtx('[[foo', 5);
    const result = source(ctx);

    expect(result).not.toBeNull();
    const options = (result as NonNullable<typeof result>).options;
    expect(options).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'foo' })]),
    );
  });

  it('filters out non-matching options when query is provided', () => {
    const source = wikiLinkSource(['notes/foo.md', 'notes/bar.md']);
    const ctx = makeCtx('[[foo', 5);
    const result = source(ctx);

    expect(result).not.toBeNull();
    const options = (result as NonNullable<typeof result>).options;
    const labels = options.map((o) => o.label);
    expect(labels).toContain('foo');
    expect(labels).not.toContain('bar');
  });

  it('filters by partial match case-insensitively', () => {
    const source = wikiLinkSource(['notes/foo.md', 'notes/bar.md']);
    const ctx = makeCtx('[[FOO', 5);
    const result = source(ctx);

    expect(result).not.toBeNull();
    const options = (result as NonNullable<typeof result>).options;
    const labels = options.map((o) => o.label);
    expect(labels).toContain('foo');
    expect(labels).not.toContain('bar');
  });

  it('deduplicates basename collisions', () => {
    const source = wikiLinkSource(['a/todo.md', 'b/todo.md']);
    const ctx = makeCtx('[[todo', 6);
    const result = source(ctx);

    expect(result).not.toBeNull();
    const options = (result as NonNullable<typeof result>).options;
    const todoOptions = options.filter((o) => o.label === 'todo');
    expect(todoOptions).toHaveLength(1);
  });

  it('appends ]] when not already present', () => {
    const source = wikiLinkSource(['notes/foo.md']);
    const ctx = makeCtx('[[foo', 5, false, '');
    const result = source(ctx);

    expect(result).not.toBeNull();
    const options = (result as NonNullable<typeof result>).options;
    const fooOption = options.find((o) => o.label === 'foo');
    expect(fooOption?.apply).toBe('foo]]');
  });

  it('does not append ]] when already present', () => {
    const source = wikiLinkSource(['notes/foo.md']);
    const ctx = makeCtx('[[foo', 5, false, ']]');
    const result = source(ctx);

    expect(result).not.toBeNull();
    const options = (result as NonNullable<typeof result>).options;
    const fooOption = options.find((o) => o.label === 'foo');
    expect(fooOption?.apply).toBe('foo');
  });

  it('returns null when not inside [[ and explicit is false', () => {
    const source = wikiLinkSource(['notes/foo.md']);
    const ctx = makeCtx('just some text', 14, false);
    const result = source(ctx);

    expect(result).toBeNull();
  });
});
