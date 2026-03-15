import { describe, expect, it } from 'vitest';
import {
  flattenFileTree,
  resolveMarkdownPath,
  resolveWikiLinkTarget,
  transformWikiLinksToMarkdown,
} from './markdownLinks';
import type { FileTreeEntry } from './api';

describe('transformWikiLinksToMarkdown', () => {
  it('converts Obsidian wiki-links into markdown links', () => {
    const content = 'Open [[Guide Note]] and [[Guide Note#Section|this section]].';

    expect(transformWikiLinksToMarkdown(content)).toBe(
      'Open [Guide Note](__wiki__/Guide%20Note.md) and [this section](__wiki__/Guide%20Note.md#Section).',
    );
  });
});

describe('resolveMarkdownPath', () => {
  it('resolves relative markdown links from the current file path', () => {
    expect(resolveMarkdownPath('docs/index.md', '../guide.md')).toBe('guide.md');
    expect(resolveMarkdownPath('docs/index.md', './nested/note.md')).toBe('docs/nested/note.md');
  });
});

describe('resolveWikiLinkTarget', () => {
  it('matches unique filenames or exact project-relative paths', () => {
    const filePaths = ['docs/guide-note.md', 'index.md'];

    expect(resolveWikiLinkTarget('docs/guide-note', filePaths)).toBe('docs/guide-note.md');
    expect(resolveWikiLinkTarget('index', filePaths)).toBe('index.md');
  });

  it('returns null for ambiguous basenames (two files with the same name in different dirs)', () => {
    const filePaths = ['a/todo.md', 'b/todo.md'];

    expect(resolveWikiLinkTarget('todo', filePaths)).toBeNull();
  });

  it('strips heading anchor when resolving wiki link target', () => {
    const filePaths = ['docs/note.md'];

    expect(resolveWikiLinkTarget('note#Section', filePaths)).toBe('docs/note.md');
  });
});

describe('flattenFileTree', () => {
  it('returns all file paths from a nested directory tree', () => {
    const tree: FileTreeEntry[] = [
      {
        name: 'docs',
        path: 'docs',
        type: 'directory',
        children: [
          { name: 'guide.md', path: 'docs/guide.md', type: 'file' },
          { name: 'index.md', path: 'docs/index.md', type: 'file' },
        ],
      },
      { name: 'readme.md', path: 'readme.md', type: 'file' },
    ];

    const result = flattenFileTree(tree);

    expect(result).toEqual(
      expect.arrayContaining(['docs/guide.md', 'docs/index.md', 'readme.md']),
    );
    expect(result).toHaveLength(3);
  });

  it('ignores directory entries themselves (only returns files)', () => {
    const tree: FileTreeEntry[] = [
      {
        name: 'docs',
        path: 'docs',
        type: 'directory',
        children: [
          { name: 'note.md', path: 'docs/note.md', type: 'file' },
        ],
      },
    ];

    const result = flattenFileTree(tree);
    expect(result).not.toContain('docs');
    expect(result).toEqual(['docs/note.md']);
  });
});
