import { describe, expect, it } from 'vitest';
import { generateTrigrams, simpleStem, fuzzyScore, fuzzySearchProjectFiles } from './fuzzySearch.js';
import type { MarkdownFileRecord } from './markdown.js';

describe('generateTrigrams', () => {
  it('generates correct trigrams for a word', () => {
    const result = generateTrigrams('hello');
    expect(result).toContain('hel');
    expect(result).toContain('ell');
    expect(result).toContain('llo');
    expect(result.size).toBe(3);
  });

  it('returns empty set for short strings', () => {
    expect(generateTrigrams('ab').size).toBe(0);
    expect(generateTrigrams('a').size).toBe(0);
    expect(generateTrigrams('').size).toBe(0);
  });

  it('lowercases input', () => {
    const result = generateTrigrams('ABC');
    expect(result).toContain('abc');
  });

  it('handles unicode', () => {
    const result = generateTrigrams('café');
    expect(result.size).toBe(2);
    expect(result).toContain('caf');
    expect(result).toContain('afé');
  });
});

describe('simpleStem', () => {
  it('strips -ing suffix', () => {
    expect(simpleStem('running')).toBe('runn');
    expect(simpleStem('testing')).toBe('test');
  });

  it('strips -ed suffix', () => {
    expect(simpleStem('tested')).toBe('test');
    expect(simpleStem('played')).toBe('play');
  });

  it('strips -ly suffix', () => {
    expect(simpleStem('quickly')).toBe('quick');
  });

  it('strips -s suffix', () => {
    expect(simpleStem('tests')).toBe('test');
    expect(simpleStem('runs')).toBe('run');
  });

  it('does not strip -ss', () => {
    expect(simpleStem('class')).toBe('class');
  });

  it('converts -tion to -t', () => {
    expect(simpleStem('creation')).toBe('creat');
  });

  it('preserves short words', () => {
    expect(simpleStem('the')).toBe('the');
    expect(simpleStem('an')).toBe('an');
  });
});

describe('fuzzyScore', () => {
  it('scores exact substring match highest', () => {
    const exactScore = fuzzyScore('hello', 'hello world');
    const partialScore = fuzzyScore('hello', 'help world');
    expect(exactScore).toBeGreaterThan(partialScore);
  });

  it('scores exact match higher than trigram-only', () => {
    const exact = fuzzyScore('test', 'this is a test document');
    const trigram = fuzzyScore('test', 'tess document');
    expect(exact).toBeGreaterThan(trigram);
  });

  it('gives zero for unrelated text', () => {
    const score = fuzzyScore('xyz', 'abcdef');
    expect(score).toBeLessThan(1);
  });

  it('gives positive score for trigram overlap', () => {
    // 'helo' and 'hello' share 'hel' and 'elo'
    const score = fuzzyScore('helo', 'hello world');
    expect(score).toBeGreaterThan(0);
  });
});

describe('fuzzySearchProjectFiles', () => {
  const files: MarkdownFileRecord[] = [
    { path: 'readme.md', content: '# Hello World\n\nThis is a readme file with testing content.' },
    { path: 'guide.md', content: '# Guide\n\nSee the documentation for more details.' },
    { path: 'notes.md', content: '# Notes\n\nRandom unrelated content about cats.' },
  ];

  it('ranks exact matches first', () => {
    const results = fuzzySearchProjectFiles(files, 'Hello');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filePath).toBe('readme.md');
  });

  it('returns results sorted by score descending', () => {
    const results = fuzzySearchProjectFiles(files, 'documentation');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('filters below threshold', () => {
    const results = fuzzySearchProjectFiles(files, 'zzzzzzzzzzz');
    expect(results).toHaveLength(0);
  });

  it('returns empty for empty query', () => {
    const results = fuzzySearchProjectFiles(files, '');
    expect(results).toHaveLength(0);
  });

  it('boosts filename matches', () => {
    const results = fuzzySearchProjectFiles(files, 'guide');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filePath).toBe('guide.md');
  });

  it('includes score in results', () => {
    const results = fuzzySearchProjectFiles(files, 'Hello');
    expect(results[0]).toHaveProperty('score');
    expect(results[0].score).toBeGreaterThan(0);
  });
});
