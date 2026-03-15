import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Columns2,
  Eye,
  Maximize2,
  Menu,
  Minimize2,
  Pencil,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/Sidebar';
import { TabBar } from '@/components/TabBar';
import { MarkdownView } from '@/components/MarkdownView';
import { cn } from '@/lib/utils';

const MarkdownEditor = lazy(() =>
  import('@/components/MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })),
);
import { useTheme } from '@/hooks/useTheme';
import { useProjects } from '@/hooks/useProjects';
import { useTabs, type Pane } from '@/hooks/useTabs';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  fetchFileContent,
  fetchProjectFiles,
  saveFileContent,
  uploadFiles,
  updateState,
  type FileTreeEntry,
  type Tab,
} from '@/lib/api';

interface PaneContentState {
  content: string | null;
  loading: boolean;
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
  } = useTabs();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autoExpandProjectId, setAutoExpandProjectId] = useState<string | null>(null);
  const [paneStates, setPaneStates] = useState(INITIAL_PANE_STATES);

  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const editModeRef = useRef(false);

  const primaryContent = paneStates.primary.content;
  const isDirty = !splitView && editMode && editContent !== primaryContent;

  const setPaneLoading = useCallback((pane: Pane, loading: boolean) => {
    setPaneStates((prev) => ({
      ...prev,
      [pane]: {
        ...prev[pane],
        loading,
      },
    }));
  }, []);

  const setPaneContent = useCallback((pane: Pane, content: string | null) => {
    setPaneStates((prev) => ({
      ...prev,
      [pane]: {
        ...prev[pane],
        content,
      },
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
          if (!cancelled) {
            setPaneContent(pane, content);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPaneContent(pane, 'Error loading file content.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPaneLoading(pane, false);
          }
        });

      return () => {
        cancelled = true;
      };
    },
    [setPaneContent, setPaneLoading],
  );

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    if (splitView && editMode) {
      setEditMode(false);
    }
  }, [editMode, splitView]);

  const prevPrimaryTabRef = useRef<Tab | null>(null);
  useEffect(() => {
    if (
      prevPrimaryTabRef.current &&
      primaryTab &&
      (prevPrimaryTabRef.current.projectId !== primaryTab.projectId ||
        prevPrimaryTabRef.current.filePath !== primaryTab.filePath)
    ) {
      setEditMode(false);
    }
    prevPrimaryTabRef.current = primaryTab;
  }, [primaryTab]);

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
    splitView,
    secondaryTab?.filePath,
    secondaryTab?.projectId,
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
    },
    [loadProjectFiles, primaryTab, secondaryTab, setPaneContent, splitView],
  );

  useWebSocket({ onFileChanged: handleFileChanged });

  const handleEnterEdit = useCallback(() => {
    if (splitView || primaryContent === null) return;
    setEditContent(primaryContent);
    setEditMode(true);
  }, [primaryContent, splitView]);

  const handleExitEdit = useCallback(() => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setEditMode(false);
  }, [isDirty]);

  const handleSave = useCallback(async () => {
    if (!primaryTab || saving) return;
    setSaving(true);
    try {
      await saveFileContent(primaryTab.projectId, primaryTab.filePath, editContent);
      setPaneContent('primary', editContent);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  }, [editContent, primaryTab, saving, setPaneContent]);

  const handleSaveAndExit = useCallback(async () => {
    if (!primaryTab || saving) return;
    setSaving(true);
    try {
      await saveFileContent(primaryTab.projectId, primaryTab.filePath, editContent);
      setPaneContent('primary', editContent);
      setEditMode(false);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  }, [editContent, primaryTab, saving, setPaneContent]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape' && fullscreenPane) {
        e.preventDefault();
        setFullscreenPane(null);
        return;
      }

      if (mod && e.key === 's') {
        e.preventDefault();
        if (editMode && primaryTab) {
          handleSave();
        }
        return;
      }

      if (mod && e.key === 'e') {
        e.preventDefault();
        if (splitView) {
          return;
        }
        if (editMode) {
          handleExitEdit();
        } else if (primaryTab && primaryContent !== null) {
          handleEnterEdit();
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.cm-editor')
      ) {
        return;
      }

      if (mod && e.key === 'w') {
        e.preventDefault();
        if (activeTab) {
          if (
            editMode &&
            isDirty &&
            primaryTab &&
            activeTab.projectId === primaryTab.projectId &&
            activeTab.filePath === primaryTab.filePath
          ) {
            if (!window.confirm('You have unsaved changes. Close anyway?')) {
              return;
            }
          }
          setEditMode(false);
          closeTab(activeTab.projectId, activeTab.filePath);
        }
        return;
      }

      if (mod && e.key === ']') {
        e.preventDefault();
        switchToNextTab();
        return;
      }

      if (mod && e.key === '[') {
        e.preventDefault();
        switchToPrevTab();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    closeTab,
    editMode,
    fullscreenPane,
    handleEnterEdit,
    handleExitEdit,
    handleSave,
    isDirty,
    primaryContent,
    primaryTab,
    setFullscreenPane,
    splitView,
    switchToNextTab,
    switchToPrevTab,
  ]);

  const getPaneTab = useCallback(
    (pane: Pane) => (pane === 'primary' ? primaryTab : secondaryTab),
    [primaryTab, secondaryTab],
  );

  const handleFileClick = useCallback(
    (projectId: string, filePath: string) => {
      openTab(projectId, filePath);
      setSidebarOpen(false);
    },
    [openTab],
  );

  const handleLinkClick = useCallback(
    (pane: Pane, filePath: string) => {
      const tab = getPaneTab(pane);
      if (!tab) return;

      const currentDir = tab.filePath.includes('/')
        ? tab.filePath.substring(0, tab.filePath.lastIndexOf('/'))
        : '';
      const resolvedPath = currentDir ? `${currentDir}/${filePath}` : filePath;

      focusPane(pane);
      openTab(tab.projectId, resolvedPath);
    },
    [focusPane, getPaneTab, openTab],
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
      } catch (error) {
        console.error('Delete failed:', error);
      }
    },
    [closeProjectTabs, removeProject],
  );

  const handleBulkDelete = useCallback(
    async (projectIds: string[]) => {
      try {
        await removeProjects(projectIds);
        for (const projectId of projectIds) {
          closeProjectTabs(projectId);
        }
      } catch (error) {
        console.error('Bulk delete failed:', error);
      }
    },
    [closeProjectTabs, removeProjects],
  );

  const handleBulkOpen = useCallback(
    async (projectIds: string[]) => {
      function collectFiles(entries: FileTreeEntry[]): string[] {
        const paths: string[] = [];
        for (const entry of entries) {
          if (entry.type === 'file') {
            paths.push(entry.path);
          } else if (entry.children) {
            paths.push(...collectFiles(entry.children));
          }
        }
        return paths;
      }

      try {
        const treesById = await Promise.all(
          projectIds.map(async (id) => ({
            id,
            files: await fetchProjectFiles(id),
          })),
        );

        for (const { id, files } of treesById) {
          for (const filePath of collectFiles(files)) {
            openTab(id, filePath);
          }
        }
      } catch (error) {
        console.error('Bulk open failed:', error);
      }
    },
    [openTab],
  );

  const handleUploadFiles = useCallback(
    async (files: File[], relativePaths?: string[]) => {
      try {
        let projectName: string;
        let cleanedPaths = relativePaths;

        if (relativePaths && relativePaths.length > 0 && relativePaths[0].includes('/')) {
          const folderName = relativePaths[0].split('/')[0];
          projectName = folderName;
          cleanedPaths = relativePaths.map((path) => {
            const slashIndex = path.indexOf('/');
            return slashIndex === -1 ? path : path.substring(slashIndex + 1);
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
      closeTab(projectId, filePath);
    },
    [closeTab, editMode, isDirty, primaryTab],
  );

  const handleSplitView = useCallback(() => {
    if (editMode) {
      if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) {
        return;
      }
      setEditMode(false);
    }
    enterSplitView();
  }, [editMode, enterSplitView, isDirty]);

  const renderMarkdownPane = useCallback(
    (
      pane: Pane,
      options: {
        allowEdit: boolean;
        splitContext: boolean;
      },
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
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
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
                      handleSaveAndExit();
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
                />
              </div>
            </Suspense>
          ) : paneState.content !== null ? (
            <div className="flex-1 overflow-auto p-6">
              <MarkdownView
                content={paneState.content}
                onLinkClick={(filePath) => handleLinkClick(pane, filePath)}
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
      editContent,
      editMode,
      exitSplitView,
      focusPane,
      focusedPane,
      fullscreenPane,
      handleCheckboxChange,
      handleEnterEdit,
      handleLinkClick,
      handleSave,
      handleSaveAndExit,
      handleSplitView,
      isDirty,
      paneStates,
      primaryTab,
      saving,
      secondaryTab,
      setFullscreenPane,
      splitView,
      theme,
    ],
  );

  const showSidebar = fullscreenPane === null;
  const showTopChrome = fullscreenPane === null;
  const fullscreenTarget = fullscreenPane ? getPaneTab(fullscreenPane) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
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
          autoExpandProjectId={autoExpandProjectId}
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
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
        ) : splitView ? (
          <div className="grid min-h-0 flex-1 gap-px bg-border md:grid-cols-2">
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
    </div>
  );
}

export default App;
