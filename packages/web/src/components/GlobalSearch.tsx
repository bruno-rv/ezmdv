import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { searchAllProjects } from '@/lib/api';

interface GlobalSearchProps {
  onFilterChange: (filter: Map<string, Set<string>> | null) => void;
}

export function GlobalSearch({ onFilterChange }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setLoading(false);
      onFilterChange(null);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await searchAllProjects(value);
        const filter = new Map<string, Set<string>>();
        for (const result of response.results) {
          let paths = filter.get(result.projectId);
          if (!paths) {
            paths = new Set();
            filter.set(result.projectId, paths);
          }
          paths.add(result.filePath);
        }
        onFilterChange(filter);
      } catch {
        onFilterChange(new Map());
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [onFilterChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasQuery = query.trim().length > 0;

  return (
    <div className="px-3 pb-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search all projects..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-muted/50 py-1.5 pl-8 pr-7 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        {hasQuery && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQuery('');
              setLoading(false);
              onFilterChange(null);
            }}
            aria-label="Clear search"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      {loading && (
        <p className="mt-1 text-[11px] text-muted-foreground">Searching...</p>
      )}
    </div>
  );
}
