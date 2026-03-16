import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectMarkdownFiles, searchProjectFiles } from './markdown.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('collectMarkdownFiles', () => {
  it('walks project markdown files and ignores non-markdown content', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ezmdv-files-'));
    tempDirs.push(tempRoot);

    fs.mkdirSync(path.join(tempRoot, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'index.md'), '# Root');
    fs.writeFileSync(path.join(tempRoot, 'docs', 'guide.md'), 'beta guide');
    fs.writeFileSync(path.join(tempRoot, 'notes.txt'), 'ignore me');

    const files = collectMarkdownFiles(tempRoot);

    expect(files.map((file) => file.path)).toEqual(['docs/guide.md', 'index.md']);
  });

  it('feeds searchProjectFiles with current project content', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ezmdv-search-'));
    tempDirs.push(tempRoot);

    fs.writeFileSync(path.join(tempRoot, 'index.md'), 'alpha beta gamma');
    fs.writeFileSync(path.join(tempRoot, 'guide.md'), 'beta beta beta');

    const results = searchProjectFiles(collectMarkdownFiles(tempRoot), 'beta');

    expect(results.map((result) => result.filePath)).toEqual(['guide.md', 'index.md']);
    expect(results[0].matchCount).toBe(3);
  });
});
