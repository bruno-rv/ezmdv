import path from 'node:path';
import type { MarkdownFileRecord, ProjectSearchResult } from './markdown.js';

export interface FuzzySearchResult extends ProjectSearchResult {
  score: number;
}

export function generateTrigrams(text: string): Set<string> {
  const trigrams = new Set<string>();
  const lower = text.toLowerCase();
  for (let i = 0; i <= lower.length - 3; i++) {
    trigrams.add(lower.slice(i, i + 3));
  }
  return trigrams;
}

export function simpleStem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;

  if (w.endsWith('tion') && w.length > 5) return w.slice(0, -4) + 't';
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ly') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);

  return w;
}

export function fuzzyScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  let score = 0;

  // Exact substring match bonus
  if (lowerText.includes(lowerQuery)) {
    score += 10;
  }

  // Trigram overlap coefficient
  const queryTrigrams = generateTrigrams(lowerQuery);
  const textTrigrams = generateTrigrams(lowerText);
  if (queryTrigrams.size > 0) {
    let overlap = 0;
    for (const t of queryTrigrams) {
      if (textTrigrams.has(t)) overlap++;
    }
    score += overlap / queryTrigrams.size;
  }

  // Stemmed token match bonus
  const queryTokens = lowerQuery.split(/\s+/).filter(Boolean).map(simpleStem);
  const textTokens = new Set(lowerText.split(/\s+/).filter(Boolean).map(simpleStem));
  if (queryTokens.length > 0) {
    let stemMatches = 0;
    for (const qt of queryTokens) {
      if (textTokens.has(qt)) stemMatches++;
    }
    score += (stemMatches / queryTokens.length) * 3;
  }

  return score;
}

function buildPreview(content: string, query: string): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);
  if (idx !== -1) {
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + query.length + 80);
    return content.slice(start, end).replace(/\s+/g, ' ').trim();
  }

  // For fuzzy matches without exact substring, show beginning
  return content.slice(0, 120).replace(/\s+/g, ' ').trim();
}

export function fuzzySearchProjectFiles(
  files: MarkdownFileRecord[],
  query: string,
): FuzzySearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results: FuzzySearchResult[] = [];
  const threshold = 0.3;

  for (const file of files) {
    const contentScore = fuzzyScore(trimmed, file.content);
    const fileNameScore = fuzzyScore(trimmed, path.basename(file.path));
    const totalScore = contentScore + (fileNameScore > 0 ? 5 : 0);

    if (totalScore < threshold) continue;

    // Count exact matches for matchCount
    const lowerContent = file.content.toLowerCase();
    const lowerQuery = trimmed.toLowerCase();
    let matchCount = 0;
    let idx = lowerContent.indexOf(lowerQuery);
    while (idx !== -1) {
      matchCount++;
      idx = lowerContent.indexOf(lowerQuery, idx + lowerQuery.length);
    }

    results.push({
      filePath: file.path,
      fileName: path.basename(file.path),
      preview: buildPreview(file.content, trimmed),
      matchCount: Math.max(matchCount, 1),
      score: totalScore,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
