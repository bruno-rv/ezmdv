import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  Menu,
  File,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { searchAllProjects } from '@/lib/api';
import type { GlobalSearchResult } from '@/lib/api';

interface TopHeaderProps {
  zoom: number;
  onFileClick: (projectId: string, filePath: string) => void;
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export function TopHeader({
  zoom,
  onFileClick,
  onMenuClick,
  showMenu,
}: TopHeaderProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const queryIdRef = useRef(0);

  // Debounced server-side search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    clearTimeout(debounceRef.current);
    const id = ++queryIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await searchAllProjects(trimmed, 'fuzzy');
        if (id === queryIdRef.current) {
          setResults(response.results.slice(0, 15));
          setSearching(false);
        }
      } catch {
        if (id === queryIdRef.current) {
          setResults([]);
          setSearching(false);
        }
      }
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

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
        onFileClick(item.projectId, item.filePath);
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
    <header className="relative z-[100] flex h-12 shrink-0 items-center border-b border-border bg-background px-4">
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
            {searching ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="size-4 shrink-0 text-muted-foreground" />
            )}
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
            <div className="absolute left-0 top-full mt-1 w-96 rounded-lg border border-border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95">
              <div ref={listRef} className="max-h-[350px] overflow-y-auto py-1">
                {searching && results.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Searching...
                  </div>
                ) : !searching && results.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No results found
                  </div>
                ) : (
                  results.map((item, index) => (
                    <button
                      key={`${item.projectId}:${item.filePath}`}
                      className={cn(
                        'flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition-colors',
                        index === selectedIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-muted/50',
                      )}
                      onClick={() => selectResult(index)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-center gap-2">
                        <File className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 truncate text-sm font-medium">{item.fileName}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          {item.projectName}
                        </span>
                        {item.matchCount > 0 && (
                          <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                            {item.matchCount}
                          </span>
                        )}
                      </div>
                      {item.preview && (
                        <span className="truncate pl-[22px] text-xs text-muted-foreground">
                          {item.preview}
                        </span>
                      )}
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
