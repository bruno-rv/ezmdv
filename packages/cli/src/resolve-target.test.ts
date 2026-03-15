import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveTarget } from './resolve-target.js';

describe('resolveTarget', () => {
  let tmpDir: string;
  let mdFile: string;
  let subDir: string;

  beforeAll(() => {
    // Use realpathSync to resolve macOS /var -> /private/var symlink
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ezmdv-test-')));
    mdFile = path.join(tmpDir, 'README.md');
    fs.writeFileSync(mdFile, '# Hello');
    subDir = path.join(tmpDir, 'my-project');
    fs.mkdirSync(subDir);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses a .md file correctly', () => {
    const result = resolveTarget(mdFile);
    expect(result.type).toBe('file');
    expect(result.name).toBe('README');
    expect(result.path).toBe(tmpDir);
  });

  it('parses a directory correctly', () => {
    const result = resolveTarget(subDir);
    expect(result.type).toBe('directory');
    expect(result.name).toBe('my-project');
    expect(result.path).toBe(subDir);
  });

  it('resolves relative paths to absolute', () => {
    const cwd = process.cwd();
    try {
      process.chdir(tmpDir);
      const result = resolveTarget('README.md');
      expect(result.path).toBe(tmpDir);
      expect(path.isAbsolute(result.path)).toBe(true);
    } finally {
      process.chdir(cwd);
    }
  });

  it('strips .md extension (case-insensitive)', () => {
    const upperFile = path.join(tmpDir, 'Notes.MD');
    fs.writeFileSync(upperFile, '# Notes');
    try {
      const result = resolveTarget(upperFile);
      expect(result.name).toBe('Notes');
    } finally {
      fs.unlinkSync(upperFile);
    }
  });

  it('preserves name for non-.md files', () => {
    const txtFile = path.join(tmpDir, 'notes.txt');
    fs.writeFileSync(txtFile, 'hello');
    try {
      const result = resolveTarget(txtFile);
      expect(result.name).toBe('notes.txt');
    } finally {
      fs.unlinkSync(txtFile);
    }
  });

  it('throws for non-existent path', () => {
    expect(() => resolveTarget('/tmp/does-not-exist-ezmdv-xyz')).toThrow(
      'Path does not exist',
    );
  });
});
