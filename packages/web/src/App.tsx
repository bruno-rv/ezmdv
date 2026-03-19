import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import {
  ArrowRightLeft,
  Menu,
  Upload,
  X,
} from 'lucide-react';
import { PaneToolbar } from '@/components/PaneToolbar';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/Sidebar';
import { TabBar } from '@/components/TabBar';
import { TopHeader } from '@/components/TopHeader';
import { StatusBar } from '@/components/StatusBar';
import { MarkdownView } from '@/components/MarkdownView';
import { TableOfContents, type TocHeading } from '@/components/TableOfContents';
import { FileMetaTooltip } from '@/components/FileMetaTooltip';
import { GraphPanel } from '@/components/GraphPanel';
import { GraphPreviewModal } from '@/components/GraphPreviewModal';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { CommandPalette, useCommandPaletteActions } from '@/components/CommandPalette';
import { BacklinksPanel, type Backlink } from '@/components/BacklinksPanel';
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
  fetchState,
  saveFileContent,
  fetchBacklinks,
  uploadFiles,
  updateState,
  type Backlink as ApiBacklink,
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
    deleteProjectFile,
    mergeProject,
    extractSubfolder,
    mergeSubfolder,
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
  const [keyboardShortcuts, setKeyboardShortcuts] = useState<Record<string, string>>({});
  const [zoomLevels, setZoomLevels] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchState().then((s) => {
      if (s.keyboardShortcuts) setKeyboardShortcuts(s.keyboardShortcuts);
      if (s.zoomLevels) setZoomLevels(s.zoomLevels);
    }).catch(() => {});
  }, []);

  const [autoExpandProjectId, setAutoExpandProjectId] = useState<string | null>(null);
  const [paneStates, setPaneStates] = useState(INITIAL_PANE_STATES);
  const [graphProjectId, setGraphProjectId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<ProjectGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);
  const [editorFilePaths, setEditorFilePaths] = useState<string[]>([]);
  const [graphPreview, setGraphPreview] = useState<{
    projectId: string;
    filePath: string;
    content: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocHeadings, setTocHeadings] = useState<TocHeading[]>([]);
  const [tocActiveId, setTocActiveId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [backlinksOpen, setBacklinksOpen] = useState(false);
  const [backlinks, setBacklinks] = useState<ApiBacklink[]>([]);
  const [backlinksLoading, setBacklinksLoading] = useState(false);

  const pendingEditModeRef = useRef(false);
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

  useEffect(() => {
    if (!tocOpen || tocHeadings.length === 0) return;
    const scrollContainer = contentScrollRef.current;
    if (!scrollContainer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setTocActiveId(entry.target.id);
            break;
          }
        }
      },
      { root: scrollContainer, rootMargin: '0px 0px -80% 0px', threshold: 0 },
    );

    for (const heading of tocHeadings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [tocOpen, tocHeadings]);

  const handleTocHeadingClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  const handleToggleToc = useCallback(() => {
    setTocOpen((prev) => !prev);
  }, []);

  const handleHeadingsExtracted = useCallback((headings: TocHeading[]) => {
    setTocHeadings((prev) => {
      if (prev.length === headings.length && prev.every((h, i) => h.id === headings[i].id)) return prev;
      return headings;
    });
  }, []);

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

  useEffect(() => {
    if (pendingEditModeRef.current && primaryContent !== null && !editMode) {
      pendingEditModeRef.current = false;
      handleEnterEdit();
    }
  }, [primaryContent, editMode, handleEnterEdit]);

  useEffect(() => {
    if (editMode || splitView || graphProjectId) {
      setTocOpen(false);
    }
  }, [editMode, splitView, graphProjectId]);

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
    keyboardShortcuts,
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
    toggleToc: handleToggleToc,
  });

  useEffect(() => {
    function handleCmdK(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleCmdK);
    return () => window.removeEventListener('keydown', handleCmdK);
  }, []);

  useEffect(() => {
    if (!backlinksOpen || !primaryTab) {
      setBacklinks([]);
      return;
    }
    setBacklinksLoading(true);
    fetchBacklinks(primaryTab.projectId, primaryTab.filePath)
      .then(setBacklinks)
      .catch(() => setBacklinks([]))
      .finally(() => setBacklinksLoading(false));
  }, [backlinksOpen, primaryTab?.projectId, primaryTab?.filePath]);

  const commandPaletteActions = useCommandPaletteActions({
    theme,
    toggleTheme,
    editMode,
    splitView,
    handleEnterEdit,
    handleExitEdit,
    handleSplitView: useCallback(() => {
      if (editMode) {
        if (isDirty && !window.confirm('You have unsaved changes. Discard them?')) return;
        setEditMode(false);
      }
      enterSplitView();
    }, [editMode, enterSplitView, isDirty, setEditMode]),
    onShowShortcuts: useCallback(() => setShowShortcuts(true), []),
  });

  const handleBacklinkFileClick = useCallback(
    (filePath: string) => {
      if (!primaryTab) return;
      openProjectFile(primaryTab.projectId, filePath);
    },
    [primaryTab, openProjectFile],
  );

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

  const handleOpenFolder = useCallback(
    async (folderPath: string) => {
      try {
        const name = folderPath.split('/').filter(Boolean).pop() || 'Project';
        const project = await addProject({
          name,
          path: folderPath,
          source: 'cli',
        });
        await loadProjects();
        await loadProjectFiles(project.id);
        setAutoExpandProjectId(project.id);
      } catch (error) {
        console.error('Open folder failed:', error);
      }
    },
    [addProject, loadProjectFiles, loadProjects],
  );

  const handleCreateFile = useCallback(
    async (projectId: string, filePath: string, content?: string) => {
      try {
        await createFile(projectId, filePath, content);
        await loadProjectFiles(projectId);
        pendingEditModeRef.current = true;
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
      if (!source || !dest) {
        alert('Could not find one of the projects.');
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
          alert(error instanceof Error ? error.message : 'Merge failed.');
        });
    },
    [closeProjectTabs, graphProjectId, mergeProject, projects],
  );

  const handleMergeSubfolder = useCallback(
    (destProjectId: string, sourceProjectId: string, folderPath: string) => {
      mergeSubfolder(destProjectId, sourceProjectId, folderPath).catch((error) => {
        alert(error instanceof Error ? error.message : 'Merge subfolder failed.');
      });
    },
    [mergeSubfolder],
  );

  const handleExtractSubfolder = useCallback(
    (sourceProjectId: string, folderPath: string) => {
      extractSubfolder(sourceProjectId, folderPath).catch((error) => {
        alert(error instanceof Error ? error.message : 'Extract subfolder failed.');
      });
    },
    [extractSubfolder],
  );

  const handleUpdateShortcut = useCallback(
    (id: string, binding: string) => {
      const next = { ...keyboardShortcuts, [id]: binding };
      setKeyboardShortcuts(next);
      updateState({ keyboardShortcuts: next }).catch(() => {});
    },
    [keyboardShortcuts],
  );

  const handleResetShortcut = useCallback(
    (id: string) => {
      const next = { ...keyboardShortcuts };
      delete next[id];
      setKeyboardShortcuts(next);
      updateState({ keyboardShortcuts: next }).catch(() => {});
    },
    [keyboardShortcuts],
  );

  const getZoom = useCallback(
    (projectId: string, filePath: string): number => {
      return zoomLevels[`${projectId}:${filePath}`] ?? 1;
    },
    [zoomLevels],
  );

  const handleZoomChange = useCallback(
    (projectId: string, filePath: string, delta: number) => {
      const key = `${projectId}:${filePath}`;
      const current = zoomLevels[key] ?? 1;
      const next = Math.min(2, Math.max(0.5, Math.round((current + delta) * 10) / 10));
      if (next === 1) {
        const { [key]: _, ...rest } = zoomLevels;
        setZoomLevels(rest);
        updateState({ zoomLevels: rest }).catch(() => {});
      } else {
        const updated = { ...zoomLevels, [key]: next };
        setZoomLevels(updated);
        updateState({ zoomLevels: updated }).catch(() => {});
      }
    },
    [zoomLevels],
  );

  const handleZoomReset = useCallback(
    (projectId: string, filePath: string) => {
      const key = `${projectId}:${filePath}`;
      const { [key]: _, ...rest } = zoomLevels;
      setZoomLevels(rest);
      updateState({ zoomLevels: rest }).catch(() => {});
    },
    [zoomLevels],
  );

  const handleZoomSet = useCallback(
    (projectId: string, filePath: string, value: number) => {
      const key = `${projectId}:${filePath}`;
      const clamped = Math.min(2, Math.max(0.5, Math.round(value * 10) / 10));
      if (clamped === 1) {
        const { [key]: _, ...rest } = zoomLevels;
        setZoomLevels(rest);
        updateState({ zoomLevels: rest }).catch(() => {});
      } else {
        const updated = { ...zoomLevels, [key]: clamped };
        setZoomLevels(updated);
        updateState({ zoomLevels: updated }).catch(() => {});
      }
    },
    [zoomLevels],
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

  const handleDeleteFile = useCallback(
    async (projectId: string, filePath: string) => {
      try {
        if (editMode && primaryTab?.projectId === projectId && primaryTab?.filePath === filePath) {
          setEditMode(false);
        }
        await deleteProjectFile(projectId, filePath);
        closeTab(projectId, filePath);
      } catch (error) {
        console.error('Delete file failed:', error);
      }
    },
    [closeTab, deleteProjectFile, editMode, primaryTab, setEditMode],
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

  const handleTabClick = useCallback(
    (projectId: string, filePath: string) => {
      setGraphProjectId(null);
      switchTab(projectId, filePath);
    },
    [switchTab],
  );

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
        setGraphPreview({ projectId: graphProjectId, filePath, content });
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
      const zoom = tab ? getZoom(tab.projectId, tab.filePath) : 1;
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
          <PaneToolbar
            editMode={editMode && !previewOnly}
            previewOnly={previewOnly}
            pane={pane}
            splitContext={options.splitContext}
            isFocused={isFocused}
            isFullscreen={isFullscreen}
            tocOpen={tocOpen}
            backlinksOpen={backlinksOpen}
            zoom={zoom}
            isDirty={isDirty}
            saving={saving}
            filePath={tab.filePath}
            autoScroll={autoScroll}
            onRefresh={() => refreshPaneContent(pane)}
            onToggleToc={handleToggleToc}
            onToggleBacklinks={() => setBacklinksOpen((prev) => !prev)}
            onFileInfo={async () => {
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
            metaTooltipContent={
              metaTooltip && metaTooltip.filePath === tab.filePath
                ? <FileMetaTooltip data={metaTooltip.data} />
                : null
            }
            onCloseSplit={() => exitSplitView()}
            onFullscreen={() => setFullscreenPane(isFullscreen ? null : pane)}
            onZoomIn={() => handleZoomChange(tab.projectId, tab.filePath, +0.1)}
            onZoomOut={() => handleZoomChange(tab.projectId, tab.filePath, -0.1)}
            onZoomSet={(v: number) => handleZoomSet(tab.projectId, tab.filePath, v)}
            onZoomReset={() => handleZoomReset(tab.projectId, tab.filePath)}
            onSave={() => handleSave()}
            onSaveAndPreview={() => handleSave(true)}
            onSplitView={handleSplitView}
            onEdit={handleEnterEdit}
          />

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
                  projectId={tab?.projectId}
                />
              </div>
            </Suspense>
          ) : paneState.content !== null ? (
            <div className="flex flex-1 min-h-0">
              <div
                className="flex-1 overflow-auto p-6"
                ref={pane === 'primary' ? contentScrollRef : undefined}
              >
                <MarkdownView
                  content={paneState.content}
                  zoom={zoom}
                  projectId={tab.projectId}
                  onLinkClick={(target, kind) => handleLinkClick(pane, target, kind)}
                  onCheckboxChange={(index, checked) =>
                    handleCheckboxChange(pane, index, checked)
                  }
                  onHeadingsExtracted={pane === 'primary' && !previewOnly ? handleHeadingsExtracted : undefined}
                />
              </div>
              {(tocOpen || backlinksOpen) && pane === 'primary' && !previewOnly && (
                <div className="w-[250px] shrink-0 overflow-y-auto border-l border-border bg-background">
                  {tocOpen && (
                    <>
                      <div className="sticky top-0 border-b border-border bg-background px-3 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Contents
                        </span>
                      </div>
                      <TableOfContents
                        headings={tocHeadings}
                        activeId={tocActiveId}
                        onHeadingClick={handleTocHeadingClick}
                      />
                    </>
                  )}
                  {backlinksOpen && (
                    <>
                      <div className={cn('border-b border-border bg-background px-3 py-2', tocOpen && 'border-t')}>
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Backlinks ({backlinks.length})
                        </span>
                      </div>
                      <BacklinksPanel
                        backlinks={backlinks}
                        loading={backlinksLoading}
                        onFileClick={handleBacklinkFileClick}
                      />
                    </>
                  )}
                </div>
              )}
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
      getZoom,
      handleCheckboxChange,
      handleEnterEdit,
      handleLinkClick,
      handleSave,
      handleSplitView,
      handleZoomChange,
      handleZoomReset,
      handleHeadingsExtracted,
      handleTocHeadingClick,
      handleToggleToc,
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
      tocActiveId,
      tocHeadings,
      tocOpen,
      backlinks,
      backlinksLoading,
      backlinksOpen,
      handleBacklinkFileClick,
    ],
  );

  const showSidebar = fullscreenPane === null;
  const showTopChrome = fullscreenPane === null;
  const appMode = graphProjectId ? 'visualize' as const : 'edit' as const;
  const activeZoom = activeTab ? getZoom(activeTab.projectId, activeTab.filePath) : 1;
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
        'relative flex h-screen flex-col overflow-hidden bg-background text-foreground transition-colors duration-200',
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
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
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
        dragCounterRef.current = 0;
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.name.toLowerCase().endsWith('.md'),
          );
          if (files.length > 0) {
            handleUploadFiles(files);
          }
        }
      }}
    >
      {showTopChrome && (
        <TopHeader
          mode={appMode}
          onModeChange={(mode) => {
            if (mode === 'visualize') {
              const projectId = activeTab?.projectId ?? projects[0]?.id;
              if (projectId) handleOpenGraph(projectId);
            } else {
              setGraphProjectId(null);
            }
          }}
          zoom={activeZoom}
          onSearchClick={() => setCommandPaletteOpen(true)}
          onMenuClick={() => setSidebarOpen(true)}
          showMenu={showSidebar}
        />
      )}

      <div className="flex min-h-0 flex-1">
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
          onMergeSubfolder={handleMergeSubfolder}
          onExtractSubfolder={handleExtractSubfolder}
          onCreateFolder={handleCreateFolder}
          onDeleteFile={handleDeleteFile}
          autoExpandProjectId={autoExpandProjectId}
          isOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onOpenGraph={handleOpenGraph}
          onCreateFile={handleCreateFile}
          onShowShortcuts={() => setShowShortcuts(true)}
          onCreateProject={(name) => addProject({ name, path: '', source: 'upload' })}
          onOpenFolder={handleOpenFolder}
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        {showTopChrome && (
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            primaryTab={primaryTab}
            secondaryTab={secondaryTab}
            splitView={splitView}
            onTabClick={handleTabClick}
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
            getZoom={getZoom}
            onZoomChange={handleZoomChange}
            onZoomSet={handleZoomSet}
            onZoomReset={handleZoomReset}
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

        {showTopChrome && (
          <StatusBar
            connected={true}
            editMode={editMode}
            splitView={splitView}
            content={primaryContent}
            filePath={activeTab?.filePath ?? null}
          />
        )}
      </main>
      </div>
      {showShortcuts && (
        <ShortcutsModal
          onClose={() => setShowShortcuts(false)}
          keyboardShortcuts={keyboardShortcuts}
          onUpdateShortcut={handleUpdateShortcut}
          onResetShortcut={handleResetShortcut}
        />
      )}
      {graphPreview && (
        <GraphPreviewModal
          filePath={graphPreview.filePath}
          content={graphPreview.content}
          projectId={graphPreview.projectId}
          zoom={getZoom(graphPreview.projectId, graphPreview.filePath)}
          onZoomIn={() => handleZoomChange(graphPreview.projectId, graphPreview.filePath, +0.1)}
          onZoomOut={() => handleZoomChange(graphPreview.projectId, graphPreview.filePath, -0.1)}
          onZoomSet={(v: number) => handleZoomSet(graphPreview.projectId, graphPreview.filePath, v)}
          onZoomReset={() => handleZoomReset(graphPreview.projectId, graphPreview.filePath)}
          onClose={setGraphPreviewNull}
        />
      )}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        projects={projects}
        tabs={tabs}
        activeTab={activeTab}
        theme={theme}
        actions={commandPaletteActions}
        onFileSelect={(projectId, filePath) => {
          openProjectFile(projectId, filePath);
          setCommandPaletteOpen(false);
        }}
        onTabSelect={(projectId, filePath) => {
          switchTab(projectId, filePath);
          setGraphProjectId(null);
          setCommandPaletteOpen(false);
        }}
      />
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
