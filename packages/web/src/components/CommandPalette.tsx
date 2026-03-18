import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, File, Zap, Moon, Sun, Pencil, Columns2, Waypoints } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileTreeEntry, Tab } from '@/lib/api';
import type { ProjectWithFiles } from '@/hooks/useProjects';

export interface CommandPaletteAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onExecute: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectWithFiles[];
  tabs: Tab[];
  activeTab: Tab | null;
  theme: 'light' | 'dark';
  actions: CommandPaletteAction[];
  onFileSelect: (projectId: string, filePath: string) => void;
  onTabSelect: (projectId: string, filePath: string) => void;
}

interface ResultItem {
  type: 'tab' | 'file' | 'action';
  id: string;
  label: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
  onExecute: () => void;
}

function flattenFiles(entries: FileTreeEntry[], projectId: string, projectName: string): Array<{ projectId: string; projectName: string; path: string; name: string }> {
  const result: Array<{ projectId: string; projectName: string; path: string; name: string }> = [];
  for (const entry of entries) {
    if (entry.type === 'file') {
      result.push({ projectId, projectName, path: entry.path, name: entry.name });
    } else if (entry.children) {
      result.push(...flattenFiles(entry.children, projectId, projectName));
    }
  }
  return result;
}

function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t.includes(q)) {
    const idx = t.indexOf(q);
    return { match: true, score: 100 - idx + (q.length / t.length) * 50 };
  }

  let qi = 0;
  let score = 0;
  let prevMatchIdx = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      if (ti === prevMatchIdx + 1) score += 5;
      if (ti === 0 || t[ti - 1] === '/' || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') score += 8;
      prevMatchIdx = ti;
      qi++;
    }
  }

  return { match: qi === q.length, score };
}

export function CommandPalette({
  open,
  onClose,
  projects,
  tabs,
  activeTab,
  actions,
  onFileSelect,
  onTabSelect,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const allFiles = useMemo(() => {
    const files: Array<{ projectId: string; projectName: string; path: string; name: string }> = [];
    for (const p of projects) {
      if (p.files) {
        files.push(...flattenFiles(p.files, p.id, p.name));
      }
    }
    return files;
  }, [projects]);

  const results = useMemo((): ResultItem[] => {
    const isActionMode = query.startsWith('>');
    const searchQuery = isActionMode ? query.slice(1).trim() : query.trim();

    if (isActionMode) {
      const items: Array<ResultItem & { score: number }> = [];
      for (const action of actions) {
        const { match, score } = searchQuery
          ? fuzzyMatch(searchQuery, action.label)
          : { match: true, score: 0 };
        if (!match) continue;
        items.push({
          type: 'action',
          id: `action:${action.id}`,
          label: action.label,
          icon: action.icon,
          onExecute: action.onExecute,
          score,
        });
      }
      return items.sort((a, b) => b.score - a.score).slice(0, 10);
    }

    const items: Array<ResultItem & { score: number }> = [];

    for (const tab of tabs) {
      const project = projects.find((p) => p.id === tab.projectId);
      const name = tab.filePath.split('/').pop() ?? tab.filePath;
      const detail = project?.name ?? '';
      const combined = `${name} ${detail} ${tab.filePath}`;
      const { match, score } = searchQuery ? fuzzyMatch(searchQuery, combined) : { match: true, score: 50 };
      if (!match) continue;
      const isActive = activeTab?.projectId === tab.projectId && activeTab?.filePath === tab.filePath;
      items.push({
        type: 'tab',
        id: `tab:${tab.projectId}:${tab.filePath}`,
        label: name,
        detail: `${detail} — Open tab${isActive ? ' (active)' : ''}`,
        icon: File,
        onExecute: () => onTabSelect(tab.projectId, tab.filePath),
        score: score + 20,
      });
    }

    const tabSet = new Set(tabs.map((t) => `${t.projectId}:${t.filePath}`));
    for (const file of allFiles) {
      if (tabSet.has(`${file.projectId}:${file.path}`)) continue;
      const combined = `${file.name} ${file.projectName} ${file.path}`;
      const { match, score } = searchQuery ? fuzzyMatch(searchQuery, combined) : { match: true, score: 0 };
      if (!match) continue;
      items.push({
        type: 'file',
        id: `file:${file.projectId}:${file.path}`,
        label: file.name,
        detail: `${file.projectName} — ${file.path}`,
        icon: File,
        onExecute: () => onFileSelect(file.projectId, file.path),
        score,
      });
    }

    return items
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }, [query, actions, tabs, allFiles, projects, activeTab, onFileSelect, onTabSelect]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const executeSelected = useCallback(() => {
    const item = results[selectedIndex];
    if (item) {
      item.onExecute();
      onClose();
    }
  }, [results, selectedIndex, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        executeSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [results.length, executeSelected, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files, or type > for actions..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-muted/50',
                  )}
                  onClick={() => {
                    item.onExecute();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate font-medium">{item.label}</span>
                  {item.detail && (
                    <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  )}
                  {item.type === 'tab' && (
                    <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                      TAB
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
          <span className="mr-3">↑↓ navigate</span>
          <span className="mr-3">↵/tab open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

export function useCommandPaletteActions({
  theme,
  toggleTheme,
  editMode,
  splitView,
  handleEnterEdit,
  handleExitEdit,
  handleSplitView,
  onShowShortcuts,
}: {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  editMode: boolean;
  splitView: boolean;
  handleEnterEdit: () => void;
  handleExitEdit: () => void;
  handleSplitView: () => void;
  onShowShortcuts: () => void;
}): CommandPaletteAction[] {
  return useMemo(
    () => [
      {
        id: 'toggle-theme',
        label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`,
        icon: theme === 'dark' ? Sun : Moon,
        onExecute: toggleTheme,
      },
      {
        id: 'toggle-edit',
        label: editMode ? 'Exit edit mode' : 'Enter edit mode',
        icon: Pencil,
        onExecute: editMode ? handleExitEdit : handleEnterEdit,
      },
      ...(!editMode
        ? [
            {
              id: 'split-view',
              label: splitView ? 'Exit split view' : 'Open split view',
              icon: Columns2,
              onExecute: handleSplitView,
            },
          ]
        : []),
      {
        id: 'shortcuts',
        label: 'Show keyboard shortcuts',
        icon: Zap,
        onExecute: onShowShortcuts,
      },
    ],
    [theme, toggleTheme, editMode, splitView, handleEnterEdit, handleExitEdit, handleSplitView, onShowShortcuts],
  );
}
