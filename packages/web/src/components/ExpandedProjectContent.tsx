import { useState, useEffect, useMemo, useRef } from 'react';
import { FilePlus, FolderPlus, Search, Upload, Waypoints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileTreeNode } from '@/components/FileTreeNode';
import { cn } from '@/lib/utils';
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
  onCreateFile?: (projectId: string, filePath: string) => void;
  onCreateFolder?: (projectId: string, folderPath: string) => void;
  onUploadToProject?: (projectId: string, files: File[]) => void;
  globalFilter?: Set<string> | null;
  draggable?: boolean;
  onFolderDragStart?: () => void;
  onFolderDragEnd?: () => void;
}

export function ExpandedProjectContent({
  project,
  activeTab,
  onFileClick,
  onOpenGraph,
  onCreateFile,
  onCreateFolder,
  onUploadToProject,
  globalFilter,
  draggable,
  onFolderDragStart,
  onFolderDragEnd,
}: ExpandedProjectContentProps) {
  const [query, setQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<Set<string> | null>(null);
  const [searching, setSearching] = useState(false);
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchMode, setSearchMode] = useState<'exact' | 'fuzzy'>('exact');
  const createInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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
      searchProjectContent(project.id, trimmed, searchMode)
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
  }, [project.id, query, searchMode]);

  const visibleEntries = useMemo(() => {
    if (!project.files) return [];
    if (globalFilter) return filterEntries(project.files, globalFilter);
    if (!searchMatches) return project.files;
    return filterEntries(project.files, searchMatches);
  }, [project.files, searchMatches, globalFilter]);

  return (
    <div className="ml-1 space-y-2">
      {!globalFilter && (
        <div className="px-3 pt-1 space-y-1">
          {/* Row 1: full-width search */}
          <div className="flex items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search note text..."
                className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none ring-0 transition-colors focus:border-primary"
              />
            </label>
          </div>

          {/* Row 2: action icons */}
          <div className="flex items-center justify-end gap-0.5">
            <button
              className={cn(
                'shrink-0 rounded px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                searchMode === 'fuzzy'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setSearchMode((prev) => (prev === 'exact' ? 'fuzzy' : 'exact'))}
              title={searchMode === 'fuzzy' ? 'Switch to exact search' : 'Switch to fuzzy search'}
            >
              {searchMode === 'fuzzy' ? '~' : 'Aa'}
            </button>
            {onCreateFile && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setCreatingFile(true);
                  setCreatingFolder(false);
                  setNewFileName('');
                  setTimeout(() => createInputRef.current?.focus(), 0);
                }}
                aria-label="Create new file"
                title="Create new file"
              >
                <FilePlus className="size-4" />
              </Button>
            )}
            {onCreateFolder && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setCreatingFolder(true);
                  setCreatingFile(false);
                  setNewFolderName('');
                  setTimeout(() => folderInputRef.current?.focus(), 0);
                }}
                aria-label="Create new folder"
                title="Create new folder"
              >
                <FolderPlus className="size-4" />
              </Button>
            )}
            {onUploadToProject && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => uploadInputRef.current?.click()}
                  title="Upload files"
                >
                  <Upload className="size-4" />
                </Button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".md"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) onUploadToProject(project.id, Array.from(files));
                    e.target.value = '';
                  }}
                />
              </>
            )}
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
        </div>
      )}

      {creatingFile && onCreateFile && (
        <form
          className="flex items-center gap-1 px-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newFileName.trim();
            if (!name) return;
            const filePath = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
            onCreateFile(project.id, filePath);
            setCreatingFile(false);
            setNewFileName('');
          }}
        >
          <input
            ref={createInputRef}
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="new-note.md"
            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
            onBlur={() => {
              const name = newFileName.trim();
              if (name && onCreateFile) {
                const filePath = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
                onCreateFile(project.id, filePath);
              }
              setCreatingFile(false);
              setNewFileName('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setCreatingFile(false);
                setNewFileName('');
              }
            }}
          />
        </form>
      )}

      {creatingFolder && onCreateFolder && (
        <form
          className="flex items-center gap-1 px-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newFolderName.trim();
            if (!name) return;
            onCreateFolder(project.id, name);
            setCreatingFolder(false);
            setNewFolderName('');
          }}
        >
          <input
            ref={folderInputRef}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="new-folder"
            className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
            onBlur={() => {
              const name = newFolderName.trim();
              if (name && onCreateFolder) {
                onCreateFolder(project.id, name);
              }
              setCreatingFolder(false);
              setNewFolderName('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setCreatingFolder(false);
                setNewFolderName('');
              }
            }}
          />
        </form>
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
                onCreateFolder={onCreateFolder}
                draggable={draggable}
                onFolderDragStart={onFolderDragStart}
                onFolderDragEnd={onFolderDragEnd}
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
