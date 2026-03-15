import type { FileTreeEntry } from './api';

const WIKI_LINK_RE = /\[\[([^[\]]+)\]\]/g;
export const WIKI_LINK_PREFIX = '__wiki__/';

export type InternalLinkKind = 'markdown' | 'wiki';

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function normalizeReference(value: string): string {
  return normalizeFilePath(value).replace(/\.md$/i, '').trim().toLowerCase();
}

function parseWikiValue(rawValue: string): {
  target: string;
  display: string;
} | null {
  const [targetPart, aliasPart] = rawValue.split('|');
  const trimmedTarget = targetPart?.trim();
  if (!trimmedTarget) return null;

  const display =
    aliasPart?.trim() ||
    trimmedTarget.split('#')[0].split('/').pop()?.trim() ||
    trimmedTarget;

  return {
    target: trimmedTarget,
    display,
  };
}

export function transformWikiLinksToMarkdown(content: string): string {
  const lines = content.split('\n');
  let inFence = false;

  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }

      if (inFence) return line;

      return line.replace(WIKI_LINK_RE, (_match, rawValue: string) => {
        const parsed = parseWikiValue(rawValue);
        if (!parsed) return rawValue;
        const [targetPath, heading] = parsed.target.split('#');
        const encodedTarget = `${WIKI_LINK_PREFIX}${encodeURIComponent(targetPath)}.md`;
        const href = heading
          ? `${encodedTarget}#${encodeURIComponent(heading)}`
          : encodedTarget;
        return `[${parsed.display}](${href})`;
      });
    })
    .join('\n');
}

export function flattenFileTree(entries: FileTreeEntry[]): string[] {
  const paths: string[] = [];

  for (const entry of entries) {
    if (entry.type === 'file') {
      paths.push(entry.path);
      continue;
    }

    if (entry.children) {
      paths.push(...flattenFileTree(entry.children));
    }
  }

  return paths;
}

export function resolveMarkdownPath(
  sourcePath: string,
  targetPath: string,
): string {
  const [filePath] = targetPath.split('#');
  const sourceDir = sourcePath.includes('/')
    ? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
    : '';
  const joined = normalizeFilePath(sourceDir ? `${sourceDir}/${filePath}` : filePath);
  const segments = joined.split('/');
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      normalizedSegments.pop();
      continue;
    }
    normalizedSegments.push(segment);
  }

  return normalizedSegments.join('/');
}

export function resolveWikiLinkTarget(
  rawTarget: string,
  filePaths: string[],
): string | null {
  const [targetPath] = rawTarget.split('#');
  const key = normalizeReference(targetPath);
  if (!key) return null;

  const exactPath = filePaths.find((filePath) => normalizeReference(filePath) === key);
  if (exactPath) return exactPath;

  const basenameMatches = filePaths.filter(
    (filePath) =>
      normalizeReference(filePath.split('/').pop()?.replace(/\.md$/i, '') ?? '') === key,
  );

  return basenameMatches.length === 1 ? basenameMatches[0] : null;
}
