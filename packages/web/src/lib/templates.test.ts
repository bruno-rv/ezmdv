import { describe, expect, it } from 'vitest';
import { templates, formatTemplate } from './templates';

describe('templates', () => {
  it('has a blank template as the first entry', () => {
    expect(templates[0].id).toBe('blank');
    expect(templates[0].content).toBe('');
  });

  it('has at least 7 templates', () => {
    expect(templates.length).toBeGreaterThanOrEqual(7);
  });

  it('every template has required fields', () => {
    for (const t of templates) {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(typeof t.icon).toBe('string');
      expect(typeof t.content).toBe('string');
    }
  });

  it('template IDs are unique', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('formatTemplate', () => {
  it('returns empty string for blank template', () => {
    const result = formatTemplate(templates[0], { date: '2024-01-01', filename: 'test' });
    expect(result).toBe('');
  });

  it('replaces {{date}} placeholder', () => {
    const meetingNotes = templates.find((t) => t.id === 'meeting-notes')!;
    const result = formatTemplate(meetingNotes, { date: '2024-06-15', filename: 'meeting' });
    expect(result).toContain('2024-06-15');
    expect(result).not.toContain('{{date}}');
  });

  it('replaces {{filename}} placeholder', () => {
    const readme = templates.find((t) => t.id === 'readme')!;
    const result = formatTemplate(readme, { date: '2024-01-01', filename: 'MyProject' });
    expect(result).toContain('MyProject');
    expect(result).not.toContain('{{filename}}');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const template = { id: 'test', name: 'Test', icon: 'FileText', content: '{{date}} and {{date}}' };
    const result = formatTemplate(template, { date: '2024-01-01', filename: 'test' });
    expect(result).toBe('2024-01-01 and 2024-01-01');
  });
});
