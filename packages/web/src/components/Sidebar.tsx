import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
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
  FolderTree,
  Search,
  Waypoints,
  LayoutGrid,
  MoreVertical,
  FilePlus,
  HardDrive,
  Terminal,
  RefreshCw,
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
  const [sidebarMode, setSidebarMode] = useState<'explorer' | 'search' | 'graph' | 'layout'>('explorer');
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
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
  const [importOpen, setImportOpen] = useState(false);
  const extractDropCounter = useRef(0);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!projectMenuId) return;
    const handler = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [projectMenuId]);

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

  const handleFolderUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      const allFiles = Array.from(fileList);
      const mdFiles = allFiles.filter((f) => f.name.toLowerCase().endsWith('.md'));
      if (mdFiles.length === 0) return;
      const relativePaths = mdFiles.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
      onUploadFiles(mdFiles, relativePaths);
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
        {/* Project header */}
        <div
          className={cn(
            'flex items-center border-b border-border px-3 py-3',
            effectiveCollapsed ? 'justify-center md:flex-col md:gap-2' : 'justify-between',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2.5',
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
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HardDrive className="size-4" />
            </div>
            <div className={cn(effectiveCollapsed && 'md:hidden')}>
              <h1 className="text-sm font-semibold leading-tight">
                {projects.length === 1 ? projects[0].name : 'ezmdv'}
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {projects.length === 1 && projects[0].source === 'cli' ? 'CLI' : 'Local Storage'}
              </p>
            </div>
          </div>

          <div className={cn('flex items-center gap-0.5', effectiveCollapsed && 'md:flex-col')}>
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
            {!effectiveCollapsed && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onShowShortcuts}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts"
              >
                <Keyboard className="size-4" />
              </Button>
            )}
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          </div>
        </div>

        {/* Icon tab bar */}
        {!effectiveCollapsed && (
          <div className="flex items-center gap-1 border-b border-border px-3 py-2">
            {([
              { mode: 'explorer' as const, icon: FolderTree, label: 'Explorer' },
              { mode: 'search' as const, icon: Search, label: 'Search' },
              { mode: 'graph' as const, icon: Waypoints, label: 'Graph' },
              { mode: 'layout' as const, icon: LayoutGrid, label: 'Layout' },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                className={cn(
                  'flex-1 flex items-center justify-center rounded-md p-2 transition-colors',
                  sidebarMode === mode
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
                onClick={() => {
                  if (mode !== 'search') setGlobalFilter(null);
                  setSidebarMode(mode);
                }}
                title={label}
                aria-label={label}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        )}

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
        ) : sidebarMode === 'search' ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Search</span>
            </div>
            <div className="pt-1">
              <GlobalSearch onFilterChange={setGlobalFilter} />
            </div>
            {globalFilter && globalFilter.size > 0 && (
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {projects
                  .filter((p) => globalFilter.has(p.id))
                  .map((project) => (
                    <div key={project.id} className="mb-1">
                      <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                        <FolderTree className="size-3" />
                        <span>{project.name}</span>
                      </div>
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
                    </div>
                  ))}
              </div>
            )}
            {globalFilter && globalFilter.size === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No matching files found</p>
            )}
          </div>
        ) : sidebarMode === 'graph' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <Waypoints className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Select a project to view its graph</p>
            <div className="flex w-full flex-col gap-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => onOpenGraph(project.id)}
                >
                  <Waypoints className="size-3.5" />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : sidebarMode === 'layout' ? (
          <div className="flex flex-1 flex-col gap-3 px-4 py-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Layout</span>
            <div className="flex flex-col gap-1">
              {onCreateProject && (
                <button
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => {
                    const name = window.prompt('Project name:');
                    if (name?.trim()) onCreateProject(name.trim());
                  }}
                >
                  <FolderPlus className="size-4" />
                  <span>New project</span>
                </button>
              )}
              <button
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                <span>Upload files</span>
              </button>
              {projects.length > 0 && !selectMode && (
                <button
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  onClick={() => {
                    setSelectMode(true);
                    setSidebarMode('explorer');
                  }}
                >
                  <ListChecks className="size-4" />
                  <span>Select projects</span>
                </button>
              )}
            </div>

            {projects.length > 0 && (
              <>
                <span className="mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Projects</span>
                <div className="flex flex-col gap-0.5">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                      onClick={() => {
                        setSidebarMode('explorer');
                        toggleProject(project.id);
                      }}
                    >
                      <ChevronRight className="size-3.5" />
                      <span className="truncate">{project.name}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/60">
                        {project.source === 'cli' ? 'CLI' : 'Local'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
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

            <div className="px-4 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Explorer</span>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {projects.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No projects yet. Upload markdown files to get started.
                </p>
              ) : (
                projects.map((project) => {
                  const isExpanded = expandedProjects[project.id] ?? false;
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
                            <div className="relative" ref={projectMenuId === project.id ? projectMenuRef : undefined}>
                              <button
                                className="mr-1 shrink-0 rounded p-1 opacity-0 transition-all hover:bg-muted/80 group-hover/project:opacity-100 focus-visible:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectMenuId(projectMenuId === project.id ? null : project.id);
                                }}
                                aria-label={`Project actions for ${project.name}`}
                              >
                                <MoreVertical className="size-3.5" />
                              </button>
                              {projectMenuId === project.id && (
                                <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-md border border-border bg-popover py-1 text-sm shadow-md">
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-popover-foreground transition-colors hover:bg-muted/50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProjectMenuId(null);
                                      startRename(project.id, project.name);
                                    }}
                                  >
                                    <Pencil className="size-3" />
                                    Rename
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-popover-foreground transition-colors hover:bg-muted/50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProjectMenuId(null);
                                      onOpenGraph(project.id);
                                    }}
                                  >
                                    <Waypoints className="size-3" />
                                    Open Graph
                                  </button>
                                  <button
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-destructive transition-colors hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProjectMenuId(null);
                                      if (
                                        window.confirm(
                                          `Delete project "${project.name}"?${project.source === 'upload' ? ' Uploaded files will be permanently deleted.' : ''}`,
                                        )
                                      ) {
                                        onDeleteProject(project.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="size-3" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
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
              <div className="flex flex-col gap-2 border-t border-border p-3">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
                  onClick={() => {
                    const activeProject = projects.find((p) =>
                      expandedProjects[p.id],
                    );
                    if (activeProject) {
                      const name = window.prompt('File name (without .md):');
                      if (name?.trim()) {
                        onCreateFile(activeProject.id, name.trim() + '.md');
                      }
                    } else if (projects.length > 0) {
                      toggleProject(projects[0].id);
                      const name = window.prompt('File name (without .md):');
                      if (name?.trim()) {
                        onCreateFile(projects[0].id, name.trim() + '.md');
                      }
                    }
                  }}
                >
                  <FilePlus className="size-4" />
                  New File
                </Button>
                <div className="relative">
                  <button
                    className="flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setImportOpen((v) => !v)}
                  >
                    <Upload className="size-3" />
                    Import MDs
                  </button>
                  {importOpen && (
                    <div className="mt-1 rounded-md border border-border bg-popover p-1 shadow-lg">
                      <button
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setImportOpen(false);
                        }}
                      >
                        <FilePlus className="size-3.5 text-muted-foreground" />
                        Files
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
                        onClick={() => {
                          folderInputRef.current?.click();
                          setImportOpen(false);
                        }}
                      >
                        <FolderOpen className="size-3.5 text-muted-foreground" />
                        Folder
                      </button>
                    </div>
                  )}
                </div>

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
                  {...{ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>}
                  multiple
                  className="hidden"
                  onChange={handleFolderUpload}
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
