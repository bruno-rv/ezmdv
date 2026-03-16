import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface Project {
  id: string;
  name: string;
  source: 'cli' | 'upload';
  path: string;
  lastOpened: string;
}

export interface Tab {
  projectId: string;
  filePath: string;
}

export interface AppState {
  theme: 'light' | 'dark';
  projects: Project[];
  openTabs: Tab[];
  checkboxStates: Record<string, Record<string, boolean>>;
  dismissedCliPaths: string[];
}

const DEFAULT_STATE: AppState = {
  theme: 'light',
  projects: [],
  openTabs: [],
  checkboxStates: {},
  dismissedCliPaths: [],
};

function getDefaultStatePath(): string {
  return path.join(os.homedir(), '.ezmdv', 'state.json');
}

export function readState(statePath?: string): AppState {
  const filePath = statePath ?? getDefaultStatePath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(state: AppState, statePath?: string): void {
  const filePath = statePath ?? getDefaultStatePath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

export function updateState(
  partial: Partial<AppState>,
  statePath?: string,
): AppState {
  const current = readState(statePath);
  const merged: AppState = { ...current, ...partial };

  // Deep merge checkboxStates
  if (partial.checkboxStates) {
    merged.checkboxStates = { ...current.checkboxStates };
    for (const [fileKey, checks] of Object.entries(partial.checkboxStates)) {
      merged.checkboxStates[fileKey] = {
        ...current.checkboxStates[fileKey],
        ...checks,
      };
    }
  }

  writeState(merged, statePath);
  return merged;
}
