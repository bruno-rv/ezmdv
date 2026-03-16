import { useState, useEffect, useMemo } from 'react';
import { Search, Waypoints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileTreeNode } from '@/components/FileTreeNode';
import type { ProjectWithFiles } from '@/hooks/useProjects';
import { searchProjectContent, type Tab, type FileTreeEntry } from '@/lib/api';

function filterEntries(
  entries: FileTreeEntry[],
  matches: Set<string>,
): FileTreeEntry[] {
  const filtered: FileTreeEntry[] = [];

  for (const entry of entries) {
    if (entry.type === 'file') {
      if (matches.has(entry.path)) {
        filtered.push(entry);
      }
      continue;
    }

    const children = entry.children ? filterEntries(entry.children, matches) : [];
    if (children.length > 0) {
      filtered.push({ ...entry, children });
    }
  }

  return filtered;
}

interface ExpandedProjectContentProps {
  project: ProjectWithFiles;
  activeTab: Tab | null;
  onFileClick: (projectId: string, filePath: string) => void;
  onOpenGraph: (projectId: string) => void;
  globalFilter?: Set<string> | null;
}

export function ExpandedProjectContent({
  project,
  activeTab,
  onFileClick,
  onOpenGraph,
  globalFilter,
}: ExpandedProjectContentProps) {
  const [query, setQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<Set<string> | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchMatches(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setSearching(true);
      searchProjectContent(project.id, trimmed)
        .then((response) => {
          if (cancelled) return;
          setSearchMatches(new Set(response.results.map((result) => result.filePath)));
        })
        .catch(() => {
          if (!cancelled) {
            setSearchMatches(new Set());
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [project.id, query]);

  const visibleEntries = useMemo(() => {
    if (!project.files) return [];
    if (globalFilter) return filterEntries(project.files, globalFilter);
    if (!searchMatches) return project.files;
    return filterEntries(project.files, searchMatches);
  }, [project.files, searchMatches, globalFilter]);

  return (
    <div className="ml-1 space-y-2">
      {!globalFilter && (
        <div className="flex items-center gap-2 px-3 pt-1">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search note text..."
              className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none ring-0 transition-colors focus:border-primary"
            />
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenGraph(project.id)}
            aria-label={`Open graph for ${project.name}`}
            title="Open graph"
          >
            <Waypoints className="size-4" />
          </Button>
        </div>
      )}

      <div>
        {project.filesLoading ? (
          <p className="px-4 py-1 text-xs text-muted-foreground">
            Loading...
          </p>
        ) : searching ? (
          <p className="px-4 py-2 text-xs text-muted-foreground">
            Searching...
          </p>
        ) : project.files && project.files.length > 0 ? (
          visibleEntries.length > 0 ? (
            visibleEntries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                projectId={project.id}
                activeTab={activeTab}
                depth={1}
                onFileClick={onFileClick}
              />
            ))
          ) : (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              {searchMatches !== null ? 'No markdown files match your search' : 'No markdown files found'}
            </p>
          )
        ) : (
          <p className="px-4 py-1 text-xs text-muted-foreground">
            No markdown files found
          </p>
        )}
      </div>
    </div>
  );
}
