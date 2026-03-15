import type { CompletionSource } from '@codemirror/autocomplete';

export function wikiLinkSource(filePaths: string[]): CompletionSource {
  return (ctx) => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);
    const match = before.match(/\[\[([^\][]*)$/);
    if (!match && !ctx.explicit) return null;
    const query = (match?.[1] ?? '').toLowerCase();
    const after = ctx.state.sliceDoc(ctx.pos, ctx.pos + 2);
    const closeWith = after.startsWith(']]') ? '' : ']]';
    const options = filePaths
      .filter((p) => p.endsWith('.md'))
      .map((p) => p.replace(/\.md$/, '').split('/').pop() ?? p)
      .filter((label, i, arr) => arr.indexOf(label) === i)
      .filter((label) => label.toLowerCase().includes(query))
      .map((label) => ({ label, apply: label + closeWith, type: 'text' }));
    return { from: ctx.pos - (match?.[1].length ?? 0), options, validFor: /^[^\][]*/ };
  };
}
