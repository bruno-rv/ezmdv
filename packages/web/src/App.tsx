import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import {
  ArrowRightLeft,
  Columns2,
  Eye,
  Info,
  Maximize2,
  Menu,
  Minimize2,
  Pencil,
  RefreshCw,
  Save,
  Upload,
  X,
} from 'lucide-react';
import { AutoScrollControls } from '@/components/AutoScrollControls';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/Sidebar';
import { TabBar } from '@/components/TabBar';
import { MarkdownView } from '@/components/MarkdownView';
import { FileMetaTooltip } from '@/components/FileMetaTooltip';
import { GraphPanel } from '@/components/GraphPanel';
import { GraphPreviewModal } from '@/components/GraphPreviewModal';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { cn } from '@/lib/utils';

const MarkdownEditor = lazy(() =>
  import('@/components/MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })),
);
import { useTheme } from '@/hooks/useTheme';
import { useProjects } from '@/hooks/useProjects';
import { useTabs, type Pane } from '@/hooks/useTabs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useEditMode } from '@/hooks/useEditMode';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  createFile,
  fetchFileContent,
  fetchFileMetadata,
  fetchProjectFiles,
  fetchProjectGraph,
  saveFileContent,
  uploadFiles,
  updateState,
  type FileMetadata,
  type FileTreeEntry,
  type ProjectGraph,
  type Tab,
} from '@/lib/api';
import {
  flattenFileTree,
  resolveMarkdownPath,
  resolveWikiLinkTarget,
  type InternalLinkKind,
} from '@/lib/markdownLinks';

interface PaneContentState {
  content: string | null;
  loading: boolean;
}

interface PendingAnchor {
  projectId: string;
  filePath: string;
  anchor: string;
}

const INITIAL_PANE_STATES: Record<Pane, PaneContentState> = {
  primary: { content: null, loading: false },
  secondary: { content: null, loading: false },
};

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    projects,
    loadProjects,
    loadProjectFiles,
    addProject,
    renameProject,
    removeProject,
    removeProjects,
    uploadToProject,
    moveFileBetweenProjects,
    createProjectFolder,
    mergeProject,
  } = useProjects();
  const {
    tabs,
    activeTab,
    primaryTab,
    secondaryTab,
    focusedPane,
    splitView,
    fullscreenPane,
    openTab,
    closeTab,
    closeProjectTabs,
    switchTab,
    switchToNextTab,
    switchToPrevTab,
    focusPane,
    enterSplitView,
    exitSplitView,
    setFullscreenPane,
    swapPanes,
  } = useTabs();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [autoExpandProjectId, setAutoExpandProjectId] = useState<string | null>(null);
  const [paneStates, setPaneStates] = useState(INITIAL_PANE_STATES);
  const [graphProjectId, setGraphProjectId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<ProjectGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);
  const [editorFilePaths, setEditorFilePaths] = useState<string[]>([]);
  const [graphPreview, setGraphPreview] = useState<{ filePath: string; content: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const metaCacheRef = useRef<Map<string, FileMetadata>>(new Map());
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [metaTooltip, setMetaTooltip] = useState<{ filePath: string; data: FileMetadata } | null>(null);

  useEffect(() => {
    if (!metaTooltip) return;
    const close = () => setMetaTooltip(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [metaTooltip]);

  const primaryContent = paneStates.primary.content;

  const setPaneContent = useCallback((pane: Pane, content: string | null) => {
    setPaneStates((prev) => ({
      ...prev,
      [pane]: { ...prev[pane], content },
    }));
  }, []);

  const {
    editMode,
    editContent,
    saving,
    isDirty,
    editModeRef,
    setEditMode,
    setEditContent,
    handleEnterEdit,
    handleExitEdit,
    handleSave,
  } = useEditMode({
    primaryTab,
    primaryContent,
    splitView,
    setPaneContent,
  });

  const autoScroll = useAutoScroll({
    containerRef: contentScrollRef,
    enabled: !editMode && !graphProjectId && !splitView,
  });

  const setPaneLoading = useCallback((pane: Pane, loading: boolean) => {
    setPaneStates((prev) => ({
      ...prev,
      [pane]: { ...prev[pane], loading },
    }));
  }, []);

  const loadPaneContent = useCallback(
    (pane: Pane, tab: Tab | null) => {
      if (!tab) {
        setPaneStates((prev) => ({
          ...prev,
          [pane]: { content: null, loading: false },
        }));
        return () => {};
      }

      let cancelled = false;
      setPaneLoading(pane, true);

      fetchFileContent(tab.projectId, tab.filePath)
        .then((content) => {
          if (!cancelled) setPaneContent(pane, content);
        })
        .catch(() => {
          if (!cancelled) setPaneContent(pane, 'Error loading file content.');
        })
        .finally(() => {
          if (!cancelled) setPaneLoading(pane, false);
        });

      return () => { cancelled = true; };
    },
    [setPaneContent, setPaneLoading],
  );

  const refreshPaneContent = useCallback(
    (pane: Pane) => {
      const tab = pane === 'primary' ? primaryTab : secondaryTab;
      if (!tab) return;
      fetchFileContent(tab.projectId, tab.filePath)
        .then((content) => setPaneContent(pane, content))
        .catch(() => {});
    },
    [primaryTab, secondaryTab, setPaneContent],
  );

  const getPaneTab = useCallback(
    (pane: Pane) => (pane === 'primary' ? primaryTab : secondaryTab),
    [primaryTab, secondaryTab],
  );

  const getProjectFilePaths = useCallback(
    async (projectId: string): Promise<string[]> => {
      const existing = projects.find((project) => project.id === projectId)?.files;
      if (existing) return flattenFileTree(existing);
      const fetched = await fetchProjectFiles(projectId);
      return flattenFileTree(fetched);
    },
    [projects],
  );

  const openProjectFile = useCallback(
    (
      projectId: string,
      filePath: string,
      options?: { closeGraph?: boolean; anchor?: string | null },
    ) => {
      if (options?.closeGraph ?? true) setGraphProjectId(null);
      if (options?.anchor) {
        setPendingAnchor({ projectId, filePath, anchor: options.anchor });
      }
      openTab(projectId, filePath);
      setSidebarOpen(false);
    },
    [openTab],
  );

  useEffect(() => {
    if (!editMode || !primaryTab) return;
    let cancelled = false;
    getProjectFilePaths(primaryTab.projectId).then((paths) => {
      if (!cancelled) {
        setEditorFilePaths(prev =>
          prev.length === paths.length && prev.every((p, i) => p === paths[i]) ? prev : paths
        );
      }
    }).catch(() => { if (!cancelled) setEditorFilePaths([]); });
    return () => { cancelled = true; };
  }, [editMode, primaryTab?.projectId, getProjectFilePaths]);

  useEffect(() => loadPaneContent('primary', primaryTab), [
    loadPaneContent,
    primaryTab?.filePath,
    primaryTab?.projectId,
  ]);

  useEffect(() => {
    if (!splitView) {
      setPaneStates((prev) => ({
        ...prev,
        secondary: { content: null, loading: false },
      }));
      return;
    }
    return loadPaneContent('secondary', secondaryTab);
  }, [
    loadPaneContent,
    secondaryTab?.filePath,
    secondaryTab?.projectId,
    splitView,
  ]);

  useEffect(() => {
    if (!pendingAnchor) return;

    const visiblePanes: Pane[] = ['primary', 'secondary'];
    const matchingPane = visiblePanes.find((pane) => {
      const tab = getPaneTab(pane);
      if (!tab) return false;
      return (
        tab.projectId === pendingAnchor.projectId &&
        tab.filePath === pendingAnchor.filePath
      );
    });

    if (!matchingPane) return;

    const frameId = window.requestAnimationFrame(() => {
      const element = document.getElementById(pendingAnchor.anchor);
      if (element) {
        element.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      setPendingAnchor(null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    getPaneTab,
    paneStates.primary.content,
    paneStates.secondary.content,
    pendingAnchor,
  ]);

  const handleFileChanged = useCallback(
    (projectId: string, filePath: string) => {
      const matchesPrimary =
        primaryTab?.projectId === projectId && primaryTab.filePath === filePath;
      const matchesSecondary =
        splitView &&
        secondaryTab?.projectId === projectId &&
        secondaryTab.filePath === filePath;

      if (!editModeRef.current) {
        if (matchesPrimary) {
          fetchFileContent(projectId, filePath)
            .then((content) => setPaneContent('primary', content))
            .catch(() => {});
        }

        if (matchesSecondary) {
          fetchFileContent(projectId, filePath)
            .then((content) => setPaneContent('secondary', content))
            .catch(() => {});
        }
      }

      loadProjectFiles(projectId);

      if (graphProjectId === projectId) {
        fetchProjectGraph(projectId)
          .then((graph) => setGraphData(graph))
          .catch(() => {});
      }
    },
    [
      editModeRef,
      graphProjectId,
      loadProjectFiles,
      primaryTab,
      secondaryTab,
      setPaneContent,
      splitView,
    ],
  );

  useWebSocket({ onFileChanged: handleFileChanged });

  const setGraphPreviewNull = useCallback(() => setGraphPreview(null), []);

  useKeyboardShortcuts({
    activeTab,
    primaryTab,
    primaryContent,
    editMode,
    isDirty,
    splitView,
    fullscreenPane,
    showShortcuts,
    graphPreview,
    handleSave,
    handleEnterEdit,
    handleExitEdit,
    setEditMode,
    closeTab,
    switchToNextTab,
    switchToPrevTab,
    setFullscreenPane,
    setGraphPreview: setGraphPreviewNull,
    autoScrollToggle: autoScroll.toggle,
    refreshPaneContent,
  });

  const handleFileClick = useCallback(
    (projectId: string, filePath: string) => {
      openProjectFile(projectId, filePath);
    },
    [openProjectFile],
  );

  const handleLinkClick = useCallback(
    async (pane: Pane, target: string, kind: InternalLinkKind) => {
      const tab = getPaneTab(pane);
      if (!tab) return;

      focusPane(pane);

      if (kind === 'markdown') {
        const [filePath, anchor] = target.split('#');
        const resolvedPath = resolveMarkdownPath(tab.filePath, filePath);
        openProjectFile(tab.projectId, resolvedPath, { anchor: anchor || null });
        return;
      }

      const [wikiTarget, anchor] = target.split('#');
      const filePaths = await getProjectFilePaths(tab.projectId);
      const resolvedPath = resolveWikiLinkTarget(wikiTarget, filePaths);
      if (!resolvedPath) return;

      openProjectFile(tab.projectId, resolvedPath, { anchor: anchor || null });
    },
    [focusPane, getPaneTab, getProjectFilePaths, openProjectFile],
  );

  const handleCheckboxChange = useCallback(
    (pane: Pane, index: number, checked: boolean) => {
      const tab = getPaneTab(pane);
      if (!tab) return;

      const key = `${tab.projectId}:${tab.filePath}`;
      updateState({
        checkboxStates: { [key]: { [String(index)]: checked } },
      }).catch(() => {});
    },
    [getPaneTab],
  );

  const handleRenameProject = useCallback(
    async (projectId: string, name: string) => {
      try {
        await renameProject(projectId, name);
      } catch (error) {
        console.error('Rename failed:', error);
      }
    },
    [renameProject],
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      try {
        await removeProject(projectId);
        closeProjectTabs(projectId);
        if (graphProjectId === projectId) {
          setGraphProjectId(null);
          setGraphData(null);
        }
      } catch (error) {
        console.error('Delete failed:', error);
      }
    },
    [closeProjectTabs, graphProjectId, removeProject],
  );

  const handleBulkDelete = useCallback(
    async (projectIds: string[]) => {
      try {
        await removeProjects(projectIds);
        for (const projectId of projectIds) {
          closeProjectTabs(projectId);
        }
        if (graphProjectId && projectIds.includes(graphProjectId)) {
          setGraphProjectId(null);
          setGraphData(null);
        }
      } catch (error) {
        console.error('Bulk delete failed:', error);
      }
    },
    [closeProjectTabs, graphProjectId, removeProjects],
  );

  const handleBulkOpen = useCallback(
    async (projectIds: string[]) => {
      try {
        const treesById = await Promise.all(
          projectIds.map(async (id) => ({
            id,
            files: await fetchProjectFiles(id),
          })),
        );

        for (const { id, files } of treesById) {
          for (const filePath of flattenFileTree(files)) {
            openProjectFile(id, filePath, { closeGraph: false });
          }
        }
      } catch (error) {
        console.error('Bulk open failed:', error);
      }
    },
    [openProjectFile],
  );

  const handleUploadFiles = useCallback(
    async (files: File[], relativePaths?: string[]) => {
      try {
        let projectName: string;
        let cleanedPaths = relativePaths;

        if (relativePaths && relativePaths.length > 0 && relativePaths[0].includes('/')) {
          const folderName = relativePaths[0].split('/')[0];
          projectName = folderName;
          cleanedPaths = relativePaths.map((filePath) => {
            const slashIndex = filePath.indexOf('/');
            return slashIndex === -1 ? filePath : filePath.substring(slashIndex + 1);
          });
        } else {
          const firstName = files[0]?.name ?? 'Uploaded Files';
          projectName =
            files.length === 1
              ? firstName.replace(/\.md$/i, '')
              : `Upload ${new Date().toLocaleDateString()}`;
        }

        const project = await addProject({
          name: projectName,
          path: '',
          source: 'upload',
        });

        await uploadFiles(project.id, files, cleanedPaths);
        await loadProjects();
        await loadProjectFiles(project.id);
        setAutoExpandProjectId(project.id);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    },
    [addProject, loadProjectFiles, loadProjects],
  );

  const handleCreateFile = useCallback(
    async (projectId: string, filePath: string) => {
      try {
        await createFile(projectId, filePath);
        await loadProjectFiles(projectId);
        openProjectFile(projectId, filePath);
      } catch (error) {
        console.error('Create file failed:', error);
      }
    },
    [loadProjectFiles, openProjectFile],
  );

  const handleUploadToProject = useCallback(
    async (projectId: string, files: File[]) => {
      try {
        await uploadToProject(projectId, files);
      } catch (error) {
        console.error('Upload to project failed:', error);
      }
    },
    [uploadToProject],
  );

  const handleMoveFile = useCallback(
    async (destProjectId: string, sourceProjectId: string, sourceFilePath: string, destFilePath: string) => {
      try {
        const result = await moveFileBetweenProjects(destProjectId, sourceProjectId, sourceFilePath, destFilePath);
        if (result.sourceProjectDeleted) {
          closeProjectTabs(sourceProjectId);
          if (graphProjectId === sourceProjectId) {
            setGraphProjectId(null);
            setGraphData(null);
          }
        }
      } catch (error) {
        console.error('Move file failed:', error);
      }
    },
    [closeProjectTabs, graphProjectId, moveFileBetweenProjects],
  );

  const handleMergeProject = useCallback(
    (destProjectId: string, sourceProjectId: string) => {
      const source = projects.find((p) => p.id === sourceProjectId);
      const dest = projects.find((p) => p.id === destProjectId);
      if (!source || !dest) return;
      if (
        !window.confirm(
          `Merge "${source.name}" into "${dest.name}" as a subfolder?`,
        )
      ) {
        return;
      }
      mergeProject(destProjectId, sourceProjectId)
        .then(() => {
          closeProjectTabs(sourceProjectId);
          if (graphProjectId === sourceProjectId) {
            setGraphProjectId(null);
            setGraphData(null);
          }
        })
        .catch((error) => {
          console.error('Merge project failed:', error);
        });
    },
    [closeProjectTabs, graphProjectId, mergeProject, projects],
  );

  const handleCreateFolder = useCallback(
    async (projectId: string, folderPath: string) => {
      try {
        await createProjectFolder(projectId, folderPath);
      } catch (error) {
        console.error('Create folder failed:', error);
      }
    },
    [createProjectFolder],
  );

  const handleTabClose = useCallback(
    (projectId: string, filePath: string) => {
      if (
        editMode &&
        isDirty &&
        primaryTab &&
        primaryTab.projectId === projectId &&
        primaryTab.filePath === filePath
      ) {
        if (!window.confirm('You have unsaved changes. Close anyway?')) {
          return;
        }
        setEditMode(false);
      }
      autoScroll.stop();
      closeTab(projectId, filePath);
    },
    [autoScroll, closeTab, editMode, isDirty, primaryTab, setEditMode],
  );

  const handleSplitView = useCallback(() => {
    if (editMode) {
      if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) {
        return;
      }
      setEditMode(false);
    }
    enterSplitView();
  }, [editMode, enterSplitView, isDirty, setEditMode]);

  const handleOpenGraph = useCallback(async (projectId: string) => {
    setGraphProjectId(projectId);
    setGraphLoading(true);
    try {
      const graph = await fetchProjectGraph(projectId);
      setGraphData(graph);
    } catch (error) {
      console.error('Graph load failed:', error);
      setGraphData(null);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  const handleGraphNodeOpen = useCallback(
    async (filePath: string) => {
      if (!graphProjectId) return;
      try {
        const content = await fetchFileContent(graphProjectId, filePath);
        setGraphPreview({ filePath, content });
      } catch {
        // ignore
      }
    },
    [graphProjectId],
  );

  const renderMarkdownPane = useCallback(
    (
      pane: Pane,
      options: { allowEdit: boolean; splitContext: boolean },
    ) => {
      const tab = pane === 'primary' ? primaryTab : secondaryTab;
      const paneState = paneStates[pane];
      const isFocused = focusedPane === pane;
      const isFullscreen = fullscreenPane === pane;
      const previewOnly = splitView || pane === 'secondary';

      if (!tab) {
        return (
          <div
            className={cn(
              'flex h-full flex-col bg-background',
              options.splitContext && 'justify-center px-6 text-center',
            )}
            onClick={() => focusPane(pane)}
          >
            <div className="mx-auto max-w-sm space-y-2 text-sm text-muted-foreground">
              <p className="text-foreground">Open another markdown to compare side by side.</p>
              <p>The next file you select will appear here.</p>
            </div>
          </div>
        );
      }

      return (
        <div
          className={cn(
            'flex h-full min-h-0 flex-col bg-background',
            options.splitContext &&
              (isFocused
                ? 'ring-1 ring-inset ring-primary/25'
                : 'ring-1 ring-inset ring-border'),
          )}
          onClick={() => focusPane(pane)}
        >
          <div className="relative flex items-center gap-2 border-b border-border px-4 py-2">
            {options.splitContext && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                  isFocused
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-muted/60 text-muted-foreground',
                )}
              >
                {pane === 'primary' ? 'Left' : 'Right'}
              </span>
            )}

            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {tab.filePath}
            </span>

            {!editMode && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  refreshPaneContent(pane);
                }}
                aria-label="Refresh from disk"
                title="Refresh from disk (Ctrl+Shift+R)"
              >
                <RefreshCw className="size-4" />
              </Button>
            )}

            <div
              className="relative"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="File info"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (metaTooltip?.filePath === tab.filePath) {
                    setMetaTooltip(null);
                    return;
                  }
                  const cacheKey = `${tab.projectId}:${tab.filePath}`;
                  const cached = metaCacheRef.current.get(cacheKey);
                  if (cached) {
                    setMetaTooltip({ filePath: tab.filePath, data: cached });
                    return;
                  }
                  try {
                    const data = await fetchFileMetadata(tab.projectId, tab.filePath);
                    metaCacheRef.current.set(cacheKey, data);
                    setMetaTooltip({ filePath: tab.filePath, data });
                  } catch {
                    // ignore
                  }
                }}
              >
                <Info className="size-4" />
              </Button>
              {metaTooltip && metaTooltip.filePath === tab.filePath && (
                <FileMetaTooltip data={metaTooltip.data} />
              )}
            </div>

            {options.splitContext && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  exitSplitView();
                }}
                aria-label="Close split view"
                title="Close split view"
              >
                <Columns2 className="size-4" />
              </Button>
            )}

            {!editMode && !previewOnly && pane === 'primary' && (
              <AutoScrollControls
                active={autoScroll.active}
                intervalSeconds={autoScroll.intervalSeconds}
                scrollPercent={autoScroll.scrollPercent}
                onToggle={autoScroll.toggle}
                onIntervalChange={autoScroll.setIntervalSeconds}
                onPercentChange={autoScroll.setScrollPercent}
              />
            )}

            {(!editMode || previewOnly) && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenPane(isFullscreen ? null : pane);
                }}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
            )}

            {options.allowEdit &&
              (editMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave(true);
                    }}
                    disabled={saving}
                    aria-label="Save and preview"
                    title="Save and preview (Ctrl+E)"
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave();
                    }}
                    disabled={saving || !isDirty}
                    aria-label="Save"
                    title="Save (Ctrl+S)"
                  >
                    <Save className="size-4" />
                  </Button>
                  {isDirty && (
                    <span className="text-xs font-medium text-amber-500">Unsaved</span>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSplitView();
                    }}
                    aria-label="Open split view"
                    title="Open split view"
                  >
                    <Columns2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnterEdit();
                    }}
                    aria-label="Edit file"
                    title="Edit (Ctrl+E)"
                  >
                    <Pencil className="size-4" />
                  </Button>
                </>
              ))}
          </div>

          {paneState.loading ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : editMode && !previewOnly ? (
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading editor...</p>
                </div>
              }
            >
              <div className="flex-1 min-h-0 overflow-hidden">
                <MarkdownEditor
                  content={editContent}
                  theme={theme}
                  onChange={setEditContent}
                  filePaths={editorFilePaths}
                />
              </div>
            </Suspense>
          ) : paneState.content !== null ? (
            <div
              className="flex-1 overflow-auto p-6"
              ref={pane === 'primary' ? contentScrollRef : undefined}
            >
              <MarkdownView
                content={paneState.content}
                onLinkClick={(target, kind) => handleLinkClick(pane, target, kind)}
                onCheckboxChange={(index, checked) =>
                  handleCheckboxChange(pane, index, checked)
                }
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a file to view</p>
            </div>
          )}
        </div>
      );
    },
    [
      autoScroll,
      editContent,
      editMode,
      editorFilePaths,
      exitSplitView,
      focusPane,
      focusedPane,
      fullscreenPane,
      handleCheckboxChange,
      handleEnterEdit,
      handleLinkClick,
      handleSave,
      handleSplitView,
      isDirty,
      metaTooltip,
      paneStates,
      primaryTab,
      refreshPaneContent,
      saving,
      secondaryTab,
      setEditContent,
      setFullscreenPane,
      splitView,
      theme,
    ],
  );

  const showSidebar = fullscreenPane === null;
  const showTopChrome = fullscreenPane === null;
  const fullscreenTarget = fullscreenPane ? getPaneTab(fullscreenPane) : null;
  const graphProject = graphProjectId
    ? projects.find((project) => project.id === graphProjectId) ?? null
    : null;
  const openFilePaths = useMemo(
    () =>
      new Set(
        [primaryTab?.filePath, secondaryTab?.filePath].filter(
          (filePath): filePath is string => Boolean(filePath),
        ),
      ),
    [primaryTab?.filePath, secondaryTab?.filePath],
  );

  return (
    <div
      className={cn(
        'relative flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-200',
        dragOver && 'ring-2 ring-inset ring-primary/50',
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) {
          dragCounterRef.current++;
          setDragOver(true);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragCounterRef.current--;
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          setDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter((f) =>
          f.name.toLowerCase().endsWith('.md'),
        );
        if (files.length > 0) {
          handleUploadFiles(files);
        }
      }}
    >
      {showSidebar && (
        <Sidebar
          projects={projects}
          activeTab={activeTab}
          theme={theme}
          onThemeToggle={toggleTheme}
          onFileClick={handleFileClick}
          onExpandProject={loadProjectFiles}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
          onBulkDelete={handleBulkDelete}
          onBulkOpen={handleBulkOpen}
          onUploadFiles={handleUploadFiles}
          onUploadToProject={handleUploadToProject}
          onMoveFile={handleMoveFile}
          onMergeProject={handleMergeProject}
          onCreateFolder={handleCreateFolder}
          autoExpandProjectId={autoExpandProjectId}
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onOpenGraph={handleOpenGraph}
          onCreateFile={handleCreateFile}
          onShowShortcuts={() => setShowShortcuts(true)}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        {showTopChrome && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="size-5" />
            </Button>
            <span className="text-sm font-semibold">ezmdv</span>
          </div>
        )}

        {showTopChrome && (
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            primaryTab={primaryTab}
            secondaryTab={secondaryTab}
            splitView={splitView}
            onTabClick={switchTab}
            onTabClose={handleTabClose}
          />
        )}

        {fullscreenPane && fullscreenTarget ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {renderMarkdownPane(fullscreenPane, {
              allowEdit: fullscreenPane === 'primary' && !splitView,
              splitContext: splitView,
            })}
          </div>
        ) : graphProject ? (
          <GraphPanel
            projectName={graphProject.name}
            projectId={graphProject.id}
            graph={graphData}
            loading={graphLoading}
            openFilePaths={openFilePaths}
            onClose={() => setGraphProjectId(null)}
            onOpenFile={handleGraphNodeOpen}
          />
        ) : splitView ? (
          <div className="relative grid min-h-0 flex-1 gap-px bg-border md:grid-cols-2">
            <div className="min-h-0 bg-background">
              {renderMarkdownPane('primary', {
                allowEdit: false,
                splitContext: true,
              })}
            </div>
            <div className="min-h-0 bg-background">
              {renderMarkdownPane('secondary', {
                allowEdit: false,
                splitContext: true,
              })}
            </div>
            {primaryTab && secondaryTab && (
              <div className="pointer-events-none absolute inset-x-0 top-3 hidden justify-center md:flex">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="pointer-events-auto shadow-sm"
                  onClick={swapPanes}
                  aria-label="Swap panes"
                  title="Swap panes"
                >
                  <ArrowRightLeft className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ) : primaryTab ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {renderMarkdownPane('primary', {
              allowEdit: true,
              splitContext: false,
            })}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Select a file to view</p>
          </div>
        )}
      </main>
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {graphPreview && (
        <GraphPreviewModal
          filePath={graphPreview.filePath}
          content={graphPreview.content}
          onClose={setGraphPreviewNull}
        />
      )}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-12 py-10">
            <Upload className="size-10 text-primary/70" />
            <p className="text-sm font-medium text-primary">Drop .md files to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
