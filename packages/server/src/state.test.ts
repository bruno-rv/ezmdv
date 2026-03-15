import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readState, writeState, updateState, type AppState } from './state.js';

let tmpDir: string;
let statePath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezmdv-test-'));
  statePath = path.join(tmpDir, 'state.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('readState', () => {
  it('returns default state when file is missing', () => {
    const state = readState(statePath);
    expect(state).toEqual({
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {},
    });
  });

  it('handles corrupt JSON gracefully', () => {
    fs.writeFileSync(statePath, '{not valid json!!!', 'utf-8');
    const state = readState(statePath);
    expect(state).toEqual({
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {},
    });
  });

  it('reads valid state from file', () => {
    const expected: AppState = {
      theme: 'dark',
      projects: [
        {
          id: 'test-id',
          name: 'Test',
          source: 'cli',
          path: '/tmp/test',
          lastOpened: '2024-01-01T00:00:00.000Z',
        },
      ],
      openTabs: [],
      checkboxStates: {},
    };
    fs.writeFileSync(statePath, JSON.stringify(expected), 'utf-8');
    const state = readState(statePath);
    expect(state).toEqual(expected);
  });
});

describe('writeState', () => {
  it('creates directory and file', () => {
    const nestedPath = path.join(tmpDir, 'nested', 'dir', 'state.json');
    const state: AppState = {
      theme: 'dark',
      projects: [],
      openTabs: [],
      checkboxStates: {},
    };
    writeState(state, nestedPath);

    expect(fs.existsSync(nestedPath)).toBe(true);
    const raw = fs.readFileSync(nestedPath, 'utf-8');
    expect(JSON.parse(raw)).toEqual(state);
  });

  it('overwrites existing file', () => {
    const state1: AppState = {
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {},
    };
    writeState(state1, statePath);

    const state2: AppState = { ...state1, theme: 'dark' };
    writeState(state2, statePath);

    const result = readState(statePath);
    expect(result.theme).toBe('dark');
  });
});

describe('updateState', () => {
  it('merges partial state correctly', () => {
    const initial: AppState = {
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {},
    };
    writeState(initial, statePath);

    const result = updateState({ theme: 'dark' }, statePath);
    expect(result.theme).toBe('dark');
    expect(result.projects).toEqual([]);
    expect(result.openTabs).toEqual([]);
  });

  it('deep-merges checkboxStates', () => {
    const initial: AppState = {
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {
        'file1.md': { 'cb-0': true, 'cb-1': false },
        'file2.md': { 'cb-0': true },
      },
    };
    writeState(initial, statePath);

    const result = updateState(
      {
        checkboxStates: {
          'file1.md': { 'cb-1': true, 'cb-2': false },
          'file3.md': { 'cb-0': true },
        },
      },
      statePath,
    );

    // file1.md should have cb-0 from original, cb-1 overwritten, cb-2 new
    expect(result.checkboxStates['file1.md']).toEqual({
      'cb-0': true,
      'cb-1': true,
      'cb-2': false,
    });
    // file2.md should be preserved
    expect(result.checkboxStates['file2.md']).toEqual({ 'cb-0': true });
    // file3.md should be added
    expect(result.checkboxStates['file3.md']).toEqual({ 'cb-0': true });
  });

  it('works when no prior state exists', () => {
    const result = updateState({ theme: 'dark' }, statePath);
    expect(result.theme).toBe('dark');
    expect(result.projects).toEqual([]);
  });
});
