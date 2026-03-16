import { describe, expect, it } from 'vitest';
import { isPathWithinRoot } from './security.js';

describe('isPathWithinRoot', () => {
  it('allows paths within the root directory', () => {
    expect(isPathWithinRoot('/project/docs/guide.md', '/project')).toBe(true);
    expect(isPathWithinRoot('/project/a/b/c.md', '/project')).toBe(true);
  });

  it('allows the root directory itself', () => {
    expect(isPathWithinRoot('/project', '/project')).toBe(true);
  });

  it('rejects paths outside the root via ..', () => {
    expect(isPathWithinRoot('/project/../etc/passwd', '/project')).toBe(false);
  });

  it('rejects paths that are a prefix but not a subdirectory', () => {
    expect(isPathWithinRoot('/project-other/file.md', '/project')).toBe(false);
  });

  it('rejects absolute paths outside root', () => {
    expect(isPathWithinRoot('/etc/passwd', '/project')).toBe(false);
  });

  it('handles relative traversal attempts', () => {
    expect(isPathWithinRoot('/project/docs/../../secret.txt', '/project')).toBe(false);
  });
});
