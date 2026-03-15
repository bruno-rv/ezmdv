import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  FolderOpen,
  FolderClosed,
  Upload,
  Trash2,
  Pencil,
  CheckSquare,
  Square,
  ListChecks,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { ProjectWithFiles } from '@/hooks/useProjects';
import type { Tab, FileTreeEntry } from '@/lib/api';

interface SidebarProps {
  projects: ProjectWithFiles[];
  activeTab: Tab | null;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onFileClick: (projectId: string, filePath: string) => void;
  onExpandProject: (projectId: string) => void;
  onRenameProject: (projectId: string, name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onBulkDelete: (projectIds: string[]) => void;
  onBulkOpen: (projectIds: string[]) => void;
  onUploadFiles: (files: File[], relativePaths?: string[]) => void;
  autoExpandProjectId: string | null;
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

interface FileTreeNodeProps {
  entry: FileTreeEntry;
  projectId: string;
  activeTab: Tab | null;
  depth: number;
  onFileClick: (projectId: string, filePath: string) => void;
}

function FileTreeNode({
  entry,
  projectId,
  activeTab,
  depth,
  onFileClick,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);

  const isActive =
    entry.type === 'file' &&
    activeTab?.projectId === projectId &&
    activeTab?.filePath === entry.path;

  if (entry.type === 'directory') {
    return (
      <div>
        <button
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          {expanded ? (
            <FolderOpen className="size-3.5 shrink-0 text-amber-500" />
          ) : (
            <FolderClosed className="size-3.5 shrink-0 text-amber-500" />
          )}
          <span className="truncate">{entry.name}</span>
        </button>
        {expanded && entry.children && (
          <div>
            {entry.children.map((child) => (
              <FileTreeNode
                key={child.path}
                entry={child}
                projectId={projectId}
                activeTab={activeTab}
                depth={depth + 1}
                onFileClick={onFileClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={cn(
        'flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors',
        isActive
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onFileClick(projectId, entry.path)}
    >
      <File className="size-3.5 shrink-0 text-blue-500" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

export function Sidebar({
  projects,
  activeTab,
  theme,
  onThemeToggle,
  onFileClick,
  onExpandProject,
  onRenameProject,
  onDeleteProject,
  onBulkDelete,
  onBulkOpen,
  onUploadFiles,
  autoExpandProjectId,
  isOpen,
  collapsed,
  onClose,
  onToggleCollapse,
}: SidebarProps) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : true,
  );
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const effectiveCollapsed = collapsed && isDesktop;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
    };

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (autoExpandProjectId) {
      setExpandedProjects((prev) => ({ ...prev, [autoExpandProjectId]: true }));
    }
  }, [autoExpandProjectId]);

  useEffect(() => {
    if (effectiveCollapsed) {
      setShowUploadMenu(false);
      setSelectMode(false);
      setSelectedIds(new Set());
      setRenamingId(null);
    }
  }, [effectiveCollapsed]);

  const toggleProject = useCallback(
    (projectId: string) => {
      setExpandedProjects((prev) => {
        const isExpanding = !prev[projectId];
        if (isExpanding) {
          onExpandProject(projectId);
        }
        return { ...prev, [projectId]: isExpanding };
      });
    },
    [onExpandProject],
  );

  const toggleSelect = useCallback((projectId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === projects.length) {
        return new Set();
      }
      return new Set(projects.map((project) => project.id));
    });
  }, [projects]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const startRename = useCallback((projectId: string, currentName: string) => {
    setRenamingId(projectId);
    setRenameValue(currentName);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameProject(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [onRenameProject, renameValue, renamingId]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    const hasUploads = projects
      .filter((project) => selectedIds.has(project.id))
      .some((project) => project.source === 'upload');

    const message =
      ids.length === 1
        ? `Delete 1 project?${hasUploads ? ' Uploaded files will be permanently deleted.' : ''}`
        : `Delete ${ids.length} projects?${hasUploads ? ' Uploaded files will be permanently deleted.' : ''}`;

    if (window.confirm(message)) {
      onBulkDelete(ids);
      exitSelectMode();
    }
  }, [exitSelectMode, onBulkDelete, projects, selectedIds]);

  const handleBulkOpen = useCallback(() => {
    onBulkOpen(Array.from(selectedIds));
    exitSelectMode();
  }, [exitSelectMode, onBulkOpen, selectedIds]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onUploadFiles(Array.from(files));
      }
      e.target.value = '';
      setShowUploadMenu(false);
    },
    [onUploadFiles],
  );

  const handleFolderUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const fileArray = Array.from(files);
        const relativePaths = fileArray.map(
          (file) => file.webkitRelativePath || file.name,
        );
        onUploadFiles(fileArray, relativePaths);
      }
      e.target.value = '';
      setShowUploadMenu(false);
    },
    [onUploadFiles],
  );

  const selectedCount = selectedIds.size;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 md:static',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          effectiveCollapsed ? 'w-[280px] md:w-14' : 'w-[280px]',
        )}
      >
        <div
          className={cn(
            'flex items-center border-b border-border px-3 py-3',
            effectiveCollapsed ? 'justify-center md:flex-col md:gap-2' : 'justify-between',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2',
              effectiveCollapsed && 'md:flex-col',
            )}
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <File className="size-4" />
            </div>
            <div className={cn(effectiveCollapsed && 'md:hidden')}>
              <h1 className="text-lg font-bold tracking-tight">ezmdv</h1>
            </div>
          </div>

          <div className={cn('flex items-center gap-1', effectiveCollapsed && 'md:flex-col')}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden md:inline-flex"
              onClick={onToggleCollapse}
              aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {effectiveCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={onClose}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <X className="size-4" />
            </Button>
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          </div>
        </div>

        {effectiveCollapsed ? (
          <div className="hidden flex-1 items-center justify-center md:flex">
            <button
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </div>
        ) : (
          <>
            {selectMode && projects.length > 0 && (
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-1.5">
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={toggleSelectAll}
                >
                  {selectedIds.size === projects.length ? (
                    <CheckSquare className="size-3.5 text-primary" />
                  ) : (
                    <Square className="size-3.5" />
                  )}
                  <span>
                    {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
                  </span>
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {projects.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No projects yet. Upload markdown files to get started.
                </p>
              ) : (
                projects.map((project) => {
                  const isExpanded = expandedProjects[project.id] ?? false;
                  const isSelected = selectedIds.has(project.id);

                  return (
                    <div key={project.id} className="group/project mb-1">
                      <div className="flex items-center">
                        {selectMode ? (
                          <button
                            className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50"
                            onClick={() => toggleSelect(project.id)}
                          >
                            {isSelected ? (
                              <CheckSquare className="size-4 shrink-0 text-primary" />
                            ) : (
                              <Square className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate">{project.name}</span>
                          </button>
                        ) : renamingId === project.id ? (
                          <form
                            className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              commitRename();
                            }}
                          >
                            <input
                              ref={renameInputRef}
                              className="min-w-0 flex-1 rounded bg-muted px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-1 focus:ring-primary"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') cancelRename();
                              }}
                            />
                          </form>
                        ) : (
                          <>
                            <button
                              className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50"
                              onClick={() => toggleProject(project.id)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                startRename(project.id, project.name);
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-4 shrink-0" />
                              ) : (
                                <ChevronRight className="size-4 shrink-0" />
                              )}
                              <span className="truncate">{project.name}</span>
                            </button>
                            <button
                              className="mr-1 shrink-0 rounded p-1 opacity-0 transition-all hover:bg-muted/80 group-hover/project:opacity-100 focus-visible:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                startRename(project.id, project.name);
                              }}
                              aria-label={`Rename project ${project.name}`}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              className="mr-1 shrink-0 rounded p-1 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/project:opacity-100 focus-visible:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  window.confirm(
                                    `Delete project "${project.name}"?${project.source === 'upload' ? ' Uploaded files will be permanently deleted.' : ''}`,
                                  )
                                ) {
                                  onDeleteProject(project.id);
                                }
                              }}
                              aria-label={`Delete project ${project.name}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      {!selectMode && isExpanded && (
                        <div className="ml-1">
                          {project.filesLoading ? (
                            <p className="px-4 py-1 text-xs text-muted-foreground">
                              Loading...
                            </p>
                          ) : project.files && project.files.length > 0 ? (
                            project.files.map((entry) => (
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
                            <p className="px-4 py-1 text-xs text-muted-foreground">
                              No markdown files found
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {selectMode && selectedCount > 0 ? (
              <div className="flex gap-2 border-t border-border p-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleBulkOpen}
                >
                  <FolderOpen className="size-4" />
                  Open ({selectedCount})
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="size-4" />
                  Delete ({selectedCount})
                </Button>
              </div>
            ) : !selectMode ? (
              <div className="relative border-t border-border p-3">
                <div className="mb-2 flex items-center justify-end">
                  {projects.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        if (selectMode) {
                          exitSelectMode();
                        } else {
                          setSelectMode(true);
                        }
                      }}
                      aria-label={selectMode ? 'Exit select mode' : 'Select projects'}
                      title={selectMode ? 'Exit select mode' : 'Select projects'}
                    >
                      {selectMode ? (
                        <X className="size-4" />
                      ) : (
                        <ListChecks className="size-4" />
                      )}
                    </Button>
                  )}
                </div>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowUploadMenu((prev) => !prev)}
                >
                  <Upload className="size-4" />
                  Upload MD
                </Button>

                {showUploadMenu && (
                  <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <File className="size-4" />
                      Upload Files
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      <FolderOpen className="size-4" />
                      Upload Folder
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-expect-error webkitdirectory is non-standard but widely supported
                  webkitdirectory=""
                  className="hidden"
                  onChange={handleFolderUpload}
                />
              </div>
            ) : null}
          </>
        )}
      </aside>
    </>
  );
}
