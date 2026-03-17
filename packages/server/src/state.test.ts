import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readState, writeState, updateState, type AppState } from './state.js';

const tempDirs: string[] = [];

function makeTempStatePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezmdv-state-'));
  tempDirs.push(dir);
  return path.join(dir, 'state.json');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('readState', () => {
  it('returns default state when file does not exist', () => {
    const state = readState('/nonexistent/path/state.json');
    expect(state).toEqual({
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {},
      dismissedCliPaths: [],
      keyboardShortcuts: {},
    });
  });

  it('reads and merges saved state with defaults', () => {
    const statePath = makeTempStatePath();
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ theme: 'dark' }), 'utf-8');

    const state = readState(statePath);
    expect(state.theme).toBe('dark');
    expect(state.projects).toEqual([]);
    expect(state.openTabs).toEqual([]);
  });
});

describe('writeState', () => {
  it('creates directory and writes state file', () => {
    const statePath = makeTempStatePath();
    const state: AppState = {
      theme: 'dark',
      projects: [],
      openTabs: [{ projectId: 'p1', filePath: 'test.md' }],
      checkboxStates: {},
      dismissedCliPaths: [],
    };

    writeState(state, statePath);

    const raw = fs.readFileSync(statePath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.theme).toBe('dark');
    expect(parsed.openTabs).toHaveLength(1);
  });
});

describe('updateState', () => {
  it('merges partial updates into existing state', () => {
    const statePath = makeTempStatePath();
    writeState({
      theme: 'light',
      projects: [],
      openTabs: [{ projectId: 'p1', filePath: 'a.md' }],
      checkboxStates: {},
      dismissedCliPaths: [],
    }, statePath);

    const updated = updateState({ theme: 'dark' }, statePath);

    expect(updated.theme).toBe('dark');
    expect(updated.openTabs).toHaveLength(1);
  });

  it('deep merges checkboxStates', () => {
    const statePath = makeTempStatePath();
    writeState({
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: { 'p1:file.md': { '0': true } },
      dismissedCliPaths: [],
    }, statePath);

    const updated = updateState({
      checkboxStates: { 'p1:file.md': { '1': false } },
    }, statePath);

    expect(updated.checkboxStates['p1:file.md']).toEqual({
      '0': true,
      '1': false,
    });
  });
});
