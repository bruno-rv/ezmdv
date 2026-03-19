import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Menu,
  File,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FileTreeEntry } from '@/lib/api';
import type { ProjectWithFiles } from '@/hooks/useProjects';

function flattenFiles(
  entries: FileTreeEntry[],
  projectId: string,
  projectName: string,
): Array<{ projectId: string; projectName: string; path: string; name: string }> {
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

interface TopHeaderProps {
  zoom: number;
  projects: ProjectWithFiles[];
  onFileClick: (projectId: string, filePath: string) => void;
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export function TopHeader({
  zoom,
  projects,
  onFileClick,
  onMenuClick,
  showMenu,
}: TopHeaderProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allFiles = useMemo(() => {
    const files: Array<{ projectId: string; projectName: string; path: string; name: string }> = [];
    for (const p of projects) {
      if (p.files) {
        files.push(...flattenFiles(p.files, p.id, p.name));
      }
    }
    return files;
  }, [projects]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const items: Array<{
      projectId: string;
      projectName: string;
      path: string;
      name: string;
      score: number;
    }> = [];

    for (const file of allFiles) {
      const combined = `${file.name} ${file.projectName} ${file.path}`;
      const { match, score } = fuzzyMatch(trimmed, combined);
      if (match) {
        items.push({ ...file, score });
      }
    }

    return items.sort((a, b) => b.score - a.score).slice(0, 15);
  }, [query, allFiles]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [focused]);

  const selectResult = useCallback(
    (index: number) => {
      const item = results[index];
      if (item) {
        onFileClick(item.projectId, item.path);
        setQuery('');
        setFocused(false);
        inputRef.current?.blur();
      }
    },
    [results, onFileClick],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectResult(selectedIndex);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setQuery('');
        setFocused(false);
        inputRef.current?.blur();
      }
    },
    [results.length, selectedIndex, selectResult],
  );

  const showDropdown = focused && query.trim().length > 0;

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4">
      {/* Left: logo + search */}
      <div className="flex items-center gap-4">
        {showMenu && onMenuClick && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onMenuClick}
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </Button>
        )}
        <span className="text-base font-bold tracking-tight">ezmdv</span>
        <div ref={containerRef} className="relative hidden md:block">
          <div
            className={cn(
              'flex w-64 items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm transition-colors',
              focused
                ? 'border-primary/50 bg-background ring-1 ring-primary/20'
                : 'border-border hover:border-primary/30 hover:bg-muted/50',
            )}
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search files..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-block">
                /
              </kbd>
            )}
          </div>
          {showDropdown && (
            <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95">
              <div ref={listRef} className="max-h-[300px] overflow-y-auto py-1">
                {results.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No files found
                  </div>
                ) : (
                  results.map((item, index) => (
                    <button
                      key={`${item.projectId}:${item.path}`}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                        index === selectedIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-muted/50',
                      )}
                      onClick={() => selectResult(index)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <File className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate font-medium">{item.name}</span>
                      <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
                        {item.projectName}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: zoom indicator */}
      <div className="ml-auto flex items-center gap-1">
        {zoom !== 1 && (
          <span className="mr-1 rounded bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zoom {Math.round(zoom * 100)}%
          </span>
        )}
      </div>
    </header>
  );
}
