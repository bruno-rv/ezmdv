import fs from 'node:fs';
import path from 'node:path';
import { IGNORED_DIRS } from './constants.js';

const WIKI_LINK_RE = /\[\[([^[\]]+)\]\]/g;
const MARKDOWN_LINK_RE = /(?<!!)\[[^\]]*?\]\(([^)]+)\)/g;

export interface MarkdownFileRecord {
  path: string;
  content: string;
}

export interface ProjectGraphNode {
  id: string;
  label: string;
  filePath: string | null;
  dangling: boolean;
}

export interface ProjectGraphEdge {
  source: string;
  target: string;
  kind: 'wiki' | 'markdown';
  rawTarget: string;
}

export interface ProjectGraph {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
}

export interface ProjectSearchResult {
  filePath: string;
  fileName: string;
  preview: string;
  matchCount: number;
}

interface ParsedWikiLink {
  rawTarget: string;
  target: string;
  heading: string | null;
}

interface ParsedMarkdownLink {
  rawTarget: string;
  path: string;
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.?\//, '');
}

function normalizeReference(value: string): string {
  return normalizeFilePath(value).replace(/\.md$/i, '').trim().toLowerCase();
}

function getFileLabel(filePath: string): string {
  return path.basename(filePath).replace(/\.md$/i, '');
}

function parseWikiTarget(rawValue: string): ParsedWikiLink | null {
  const [targetPart] = rawValue.split('|');
  const trimmedTarget = targetPart?.trim();
  if (!trimmedTarget) return null;

  const hashIndex = trimmedTarget.indexOf('#');
  if (hashIndex === -1) {
    return {
      rawTarget: trimmedTarget,
      target: trimmedTarget,
      heading: null,
    };
  }

  return {
    rawTarget: trimmedTarget,
    target: trimmedTarget.slice(0, hashIndex).trim(),
    heading: trimmedTarget.slice(hashIndex + 1).trim() || null,
  };
}

function extractWikiLinks(content: string): ParsedWikiLink[] {
  const links: ParsedWikiLink[] = [];
  for (const match of content.matchAll(WIKI_LINK_RE)) {
    const parsed = parseWikiTarget(match[1] ?? '');
    if (parsed) {
      links.push(parsed);
    }
  }
  return links;
}

function extractMarkdownLinks(content: string): ParsedMarkdownLink[] {
  const links: ParsedMarkdownLink[] = [];
  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    const rawTarget = (match[1] ?? '').trim();
    if (!rawTarget) continue;
    if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
      continue;
    }

    const [filePath] = rawTarget.split('#');
    if (!/\.md$/i.test(filePath)) continue;
    links.push({ rawTarget, path: filePath });
  }
  return links;
}

function resolveMarkdownLink(
  sourcePath: string,
  rawTarget: string,
  knownFiles: Set<string>,
): string | null {
  const [targetPath] = rawTarget.split('#');
  const sourceDir = sourcePath.includes('/')
    ? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
    : '';
  const resolved = normalizeFilePath(
    path.posix.normalize(sourceDir ? `${sourceDir}/${targetPath}` : targetPath),
  );

  return knownFiles.has(resolved) ? resolved : null;
}

function buildWikiResolutionIndex(files: MarkdownFileRecord[]) {
  const byRelative = new Map<string, string>();
  const byBase = new Map<string, string[]>();

  for (const file of files) {
    const relativeKey = normalizeReference(file.path);
    byRelative.set(relativeKey, file.path);

    const baseKey = normalizeReference(getFileLabel(file.path));
    const existing = byBase.get(baseKey);
    if (existing) {
      existing.push(file.path);
    } else {
      byBase.set(baseKey, [file.path]);
    }
  }

  return { byRelative, byBase };
}

function resolveWikiLink(
  rawTarget: string,
  index: ReturnType<typeof buildWikiResolutionIndex>,
): string | null {
  const key = normalizeReference(rawTarget);
  if (!key) return null;

  const exact = index.byRelative.get(key);
  if (exact) return exact;

  const basenameMatches = index.byBase.get(key);
  if (basenameMatches?.length === 1) {
    return basenameMatches[0];
  }

  return null;
}

export function collectMarkdownFiles(projectPath: string): MarkdownFileRecord[] {
  const files: MarkdownFileRecord[] = [];

  function visit(dirPath: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        visit(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
        continue;
      }

      const relativePath = normalizeFilePath(path.relative(projectPath, fullPath));
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          path: relativePath,
          content,
        });
      } catch {
        // Skip unreadable files.
      }
    }
  }

  visit(projectPath);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

export function buildProjectGraphFromFiles(files: MarkdownFileRecord[]): ProjectGraph {
  const nodes = new Map<string, ProjectGraphNode>();
  const edges = new Map<string, ProjectGraphEdge>();
  const knownFiles = new Set(files.map((file) => file.path));
  const wikiIndex = buildWikiResolutionIndex(files);

  for (const file of files) {
    nodes.set(file.path, {
      id: file.path,
      label: getFileLabel(file.path),
      filePath: file.path,
      dangling: false,
    });
  }

  for (const file of files) {
    for (const wikiLink of extractWikiLinks(file.content)) {
      const resolvedTarget = resolveWikiLink(wikiLink.target, wikiIndex);
      const nodeId = resolvedTarget ?? `dangling:${normalizeReference(wikiLink.target)}`;

      if (!resolvedTarget && !nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          label: wikiLink.target,
          filePath: null,
          dangling: true,
        });
      }

      const edgeKey = `${file.path}->${nodeId}:wiki:${wikiLink.rawTarget}`;
      edges.set(edgeKey, {
        source: file.path,
        target: nodeId,
        kind: 'wiki',
        rawTarget: wikiLink.rawTarget,
      });
    }

    for (const markdownLink of extractMarkdownLinks(file.content)) {
      const resolvedTarget = resolveMarkdownLink(
        file.path,
        markdownLink.path,
        knownFiles,
      );
      if (!resolvedTarget) continue;

      const edgeKey = `${file.path}->${resolvedTarget}:markdown:${markdownLink.rawTarget}`;
      edges.set(edgeKey, {
        source: file.path,
        target: resolvedTarget,
        kind: 'markdown',
        rawTarget: markdownLink.rawTarget,
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
}

function buildPreview(content: string, firstIndex: number, queryLength: number): string {
  const start = Math.max(0, firstIndex - 40);
  const end = Math.min(content.length, firstIndex + queryLength + 80);
  return content
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchProjectFiles(
  files: MarkdownFileRecord[],
  query: string,
): ProjectSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const normalizedQuery = trimmed.toLowerCase();
  const results: ProjectSearchResult[] = [];

  for (const file of files) {
    const normalizedContent = file.content.toLowerCase();
    let matchCount = 0;
    let index = normalizedContent.indexOf(normalizedQuery);
    const firstIndex = index;

    while (index !== -1) {
      matchCount++;
      index = normalizedContent.indexOf(normalizedQuery, index + normalizedQuery.length);
    }

    if (matchCount === 0 || firstIndex === -1) continue;

    results.push({
      filePath: file.path,
      fileName: path.basename(file.path),
      preview: buildPreview(file.content, firstIndex, trimmed.length),
      matchCount,
    });
  }

  return results.sort((a, b) => {
    if (b.matchCount !== a.matchCount) {
      return b.matchCount - a.matchCount;
    }
    return a.filePath.localeCompare(b.filePath);
  });
}
