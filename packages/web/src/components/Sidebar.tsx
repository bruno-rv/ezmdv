import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  FolderOpen,
  Upload,
  Trash2,
  Pencil,
  CheckSquare,
  Square,
  ListChecks,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Keyboard,
  FolderPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ExpandedProjectContent } from '@/components/ExpandedProjectContent';
import { GlobalSearch } from '@/components/GlobalSearch';
import type { ProjectWithFiles } from '@/hooks/useProjects';
import type { Tab } from '@/lib/api';

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
  onUploadToProject?: (projectId: string, files: File[]) => void;
  onMoveFile?: (destProjectId: string, sourceProjectId: string, sourceFilePath: string, destFilePath: string) => Promise<void>;
  onMergeProject?: (destProjectId: string, sourceProjectId: string) => void;
  onMergeSubfolder?: (destProjectId: string, sourceProjectId: string, folderPath: string) => void;
  onExtractSubfolder?: (sourceProjectId: string, folderPath: string) => void;
  onCreateFolder?: (projectId: string, folderPath: string) => void;
  onDeleteFile?: (projectId: string, filePath: string) => void;
  autoExpandProjectId: string | null;
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onOpenGraph: (projectId: string) => void;
  onCreateFile: (projectId: string, filePath: string, content?: string) => void;
  onShowShortcuts: () => void;
  onCreateProject?: (name: string) => void;
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
  onUploadToProject,
  onMoveFile,
  onMergeProject,
  onMergeSubfolder,
  onExtractSubfolder,
  onCreateFolder,
  onDeleteFile,
  autoExpandProjectId,
  isOpen,
  collapsed,
  onClose,
  onToggleCollapse,
  onOpenGraph,
  onCreateFile,
  onShowShortcuts,
  onCreateProject,
}: SidebarProps) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : true,
  );
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [globalFilter, setGlobalFilter] = useState<Map<string, Set<string>> | null>(null);
  const [dropTargetProjectId, setDropTargetProjectId] = useState<string | null>(null);
  const [isFolderDragging, setIsFolderDragging] = useState(false);
  const [extractDropActive, setExtractDropActive] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const extractDropCounter = useRef(0);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveCollapsed = collapsed && isDesktop;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const newWidth = Math.min(Math.max(startWidth + ev.clientX - startX, 200), 600);
        setSidebarWidth(newWidth);
      };
      const onMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [sidebarWidth],
  );

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
      setSelectMode(false);
      setSelectedIds(new Set());
      setRenamingId(null);
    }
  }, [effectiveCollapsed]);

  useEffect(() => {
    if (!globalFilter) return;
    for (const projectId of globalFilter.keys()) {
      onExpandProject(projectId);
    }
  }, [globalFilter, onExpandProject]);

  useEffect(() => {
    const reset = () => {
      setIsFolderDragging(false);
      setExtractDropActive(false);
      extractDropCounter.current = 0;
    };
    document.addEventListener('dragend', reset);
    return () => document.removeEventListener('dragend', reset);
  }, []);

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
          'fixed left-0 top-0 z-50 flex h-full flex-col overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground md:static',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          effectiveCollapsed && 'md:w-14',
          isResizing ? 'select-none' : 'transition-[width,transform] duration-200',
        )}
        style={effectiveCollapsed ? undefined : { width: `${sidebarWidth}px` }}
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
            {effectiveCollapsed && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden md:inline-flex"
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            )}
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <File className="size-4" />
            </div>
            <div className={cn(effectiveCollapsed && 'md:hidden')}>
              <h1 className="text-lg font-bold tracking-tight">ezmdv</h1>
            </div>
          </div>

          <div className={cn('flex items-center gap-1', effectiveCollapsed && 'md:flex-col')}>
            {!effectiveCollapsed && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden md:inline-flex"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="size-4" />
              </Button>
            )}
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
            {!effectiveCollapsed && !selectMode && projects.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectMode(true)}
                title="Select projects"
              >
                <ListChecks className="size-4" />
              </Button>
            )}
            {!effectiveCollapsed && onCreateProject && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const name = window.prompt('Project name:');
                  if (name?.trim()) onCreateProject(name.trim());
                }}
                aria-label="Create new project"
                title="Create new project"
              >
                <FolderPlus className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onShowShortcuts}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              <Keyboard className="size-4" />
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
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-1.5">
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
                <button
                  className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={exitSelectMode}
                  aria-label="Exit select mode"
                  title="Exit select mode"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div className="pt-2">
              <GlobalSearch onFilterChange={setGlobalFilter} />
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {projects.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No projects yet. Upload markdown files to get started.
                </p>
              ) : globalFilter && globalFilter.size === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No matching files found
                </p>
              ) : (
                (globalFilter
                  ? projects.filter((p) => globalFilter.has(p.id))
                  : projects
                ).map((project) => {
                  const isExpanded = globalFilter
                    ? true
                    : expandedProjects[project.id] ?? false;
                  const isSelected = selectedIds.has(project.id);

                  const isDropTarget = dropTargetProjectId === project.id;

                  return (
                    <div
                      key={project.id}
                      className={cn(
                        'group/project mb-1 rounded',
                        isDropTarget && 'bg-primary/10 ring-1 ring-primary/30',
                      )}
                      onDragOver={(e) => {
                        if (
                          e.dataTransfer.types.includes('application/x-ezmdv-file') ||
                          e.dataTransfer.types.includes('application/x-ezmdv-project') ||
                          e.dataTransfer.types.includes('application/x-ezmdv-folder')
                        ) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDropTargetProjectId(project.id);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDropTargetProjectId(null);
                        }
                      }}
                      onDrop={(e) => {
                        setDropTargetProjectId(null);
                        const folderRaw = e.dataTransfer.getData('application/x-ezmdv-folder');
                        if (folderRaw && onMergeSubfolder) {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const { projectId: srcProjectId, folderPath } = JSON.parse(folderRaw) as {
                              projectId: string;
                              folderPath: string;
                              folderName: string;
                            };
                            if (srcProjectId !== project.id) {
                              setIsFolderDragging(false);
                              onMergeSubfolder(project.id, srcProjectId, folderPath);
                            }
                          } catch {
                            // ignore
                          }
                          return;
                        }
                        const projectRaw = e.dataTransfer.getData('application/x-ezmdv-project');
                        if (projectRaw && onMergeProject) {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const { projectId: srcProjectId } = JSON.parse(projectRaw) as { projectId: string };
                            if (srcProjectId === project.id) return;
                            onMergeProject(project.id, srcProjectId);
                          } catch {
                            // ignore
                          }
                          return;
                        }
                        const raw = e.dataTransfer.getData('application/x-ezmdv-file');
                        if (!raw || !onMoveFile) return;
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          const { projectId: srcProjectId, filePath, fileName } = JSON.parse(raw) as {
                            projectId: string;
                            filePath: string;
                            fileName: string;
                          };
                          if (srcProjectId === project.id) return;
                          onMoveFile(project.id, srcProjectId, filePath, fileName);
                        } catch {
                          // ignore malformed data
                        }
                      }}
                    >
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
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  'application/x-ezmdv-project',
                                  JSON.stringify({ projectId: project.id }),
                                );
                                e.dataTransfer.effectAllowed = 'move';
                              }}
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
                          <ExpandedProjectContent
                            project={project}
                            activeTab={activeTab}
                            onFileClick={onFileClick}
                            onOpenGraph={onOpenGraph}
                            onCreateFile={onCreateFile}
                            onCreateFolder={onCreateFolder}
                            onDeleteFile={onDeleteFile}
                            onUploadToProject={onUploadToProject}
                            globalFilter={globalFilter?.get(project.id)}
                            draggable={!!onMoveFile}
                            onFolderDragStart={() => setIsFolderDragging(true)}
                            onFolderDragEnd={() => {
                              setIsFolderDragging(false);
                              setExtractDropActive(false);
                              extractDropCounter.current = 0;
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {isFolderDragging && (
              <div
                className={cn(
                  'mx-3 mb-2 rounded border-2 border-dashed px-3 py-4 text-center text-xs text-muted-foreground transition-colors',
                  extractDropActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border',
                )}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-ezmdv-folder')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDragEnter={(e) => {
                  if (e.dataTransfer.types.includes('application/x-ezmdv-folder')) {
                    extractDropCounter.current += 1;
                    setExtractDropActive(true);
                  }
                }}
                onDragLeave={() => {
                  extractDropCounter.current -= 1;
                  if (extractDropCounter.current === 0) setExtractDropActive(false);
                }}
                onDrop={(e) => {
                  extractDropCounter.current = 0;
                  setExtractDropActive(false);
                  setIsFolderDragging(false);
                  const raw = e.dataTransfer.getData('application/x-ezmdv-folder');
                  if (!raw || !onExtractSubfolder) return;
                  e.preventDefault();
                  try {
                    const { projectId, folderPath } = JSON.parse(raw) as {
                      projectId: string;
                      folderPath: string;
                      folderName: string;
                    };
                    onExtractSubfolder(projectId, folderPath);
                  } catch {
                    // ignore
                  }
                }}
              >
                Drop to create new project
              </div>
            )}

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
              <div className="border-t border-border p-3">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Upload
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            ) : null}
          </>
        )}
        {!effectiveCollapsed && (
          <div
            className="absolute right-0 top-0 hidden h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 md:block"
            onMouseDown={handleResizeStart}
          />
        )}
      </aside>
    </>
  );
}
