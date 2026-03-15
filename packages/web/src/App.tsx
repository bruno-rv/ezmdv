import { useState, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/Sidebar';
import { TabBar } from '@/components/TabBar';
import { MarkdownView } from '@/components/MarkdownView';
import { useTheme } from '@/hooks/useTheme';
import { useProjects } from '@/hooks/useProjects';
import { useTabs } from '@/hooks/useTabs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fetchFileContent, uploadFiles, updateState } from '@/lib/api';

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    projects,
    loadProjects,
    loadProjectFiles,
    addProject,
  } = useProjects();
  const { tabs, activeTab, openTab, closeTab, switchTab, switchToNextTab, switchToPrevTab } = useTabs();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // Fetch file content when active tab changes
  useEffect(() => {
    if (!activeTab) {
      setFileContent(null);
      return;
    }

    let cancelled = false;
    setContentLoading(true);
    fetchFileContent(activeTab.projectId, activeTab.filePath)
      .then((content) => {
        if (!cancelled) {
          setFileContent(content);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFileContent('Error loading file content.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab?.projectId, activeTab?.filePath]);

  // Live reload via WebSocket
  const handleFileChanged = useCallback(
    (projectId: string, filePath: string) => {
      // If the changed file is currently displayed, re-fetch its content
      if (
        activeTab &&
        activeTab.projectId === projectId &&
        activeTab.filePath === filePath
      ) {
        fetchFileContent(projectId, filePath)
          .then((content) => setFileContent(content))
          .catch(() => {
            // Silently fail on refresh
          });
      }
      // Refresh the file tree for the affected project
      loadProjectFiles(projectId);
    },
    [activeTab, loadProjectFiles],
  );

  useWebSocket({ onFileChanged: handleFileChanged });

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + W: close active tab
      if (mod && e.key === 'w') {
        e.preventDefault();
        if (activeTab) {
          closeTab(activeTab.projectId, activeTab.filePath);
        }
        return;
      }

      // Ctrl/Cmd + ]: next tab
      if (mod && e.key === ']') {
        e.preventDefault();
        switchToNextTab();
        return;
      }

      // Ctrl/Cmd + [: previous tab
      if (mod && e.key === '[') {
        e.preventDefault();
        switchToPrevTab();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, closeTab, switchToNextTab, switchToPrevTab]);

  const handleFileClick = useCallback(
    (projectId: string, filePath: string) => {
      openTab(projectId, filePath);
      setSidebarOpen(false); // Close sidebar on mobile after click
    },
    [openTab],
  );

  const handleLinkClick = useCallback(
    (filePath: string) => {
      if (!activeTab) return;
      // Resolve relative path against the current file's directory
      const currentDir = activeTab.filePath.includes('/')
        ? activeTab.filePath.substring(0, activeTab.filePath.lastIndexOf('/'))
        : '';
      const resolvedPath = currentDir
        ? `${currentDir}/${filePath}`
        : filePath;
      openTab(activeTab.projectId, resolvedPath);
    },
    [activeTab, openTab],
  );

  const handleCheckboxChange = useCallback(
    (index: number, checked: boolean) => {
      if (!activeTab) return;
      const key = `${activeTab.projectId}:${activeTab.filePath}`;
      updateState({
        checkboxStates: { [key]: { [String(index)]: checked } },
      }).catch(() => {
        // Silently fail
      });
    },
    [activeTab],
  );

  const handleUploadFiles = useCallback(
    async (files: FileList, relativePaths?: string[]) => {
      try {
        // Create a new project for the upload
        const firstName = files[0]?.name ?? 'Uploaded Files';
        const projectName =
          files.length === 1
            ? firstName.replace(/\.md$/i, '')
            : `Upload ${new Date().toLocaleDateString()}`;

        // Server auto-generates the upload path for upload projects
        const project = await addProject({
          name: projectName,
          path: '',
          source: 'upload',
        });

        await uploadFiles(project.id, files, relativePaths);

        // Refresh to show new files
        await loadProjects();
      } catch (error) {
        console.error('Upload failed:', error);
      }
    },
    [addProject, loadProjects],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        activeTab={activeTab}
        theme={theme}
        onThemeToggle={toggleTheme}
        onFileClick={handleFileClick}
        onExpandProject={loadProjectFiles}
        onUploadFiles={handleUploadFiles}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Mobile header with hamburger */}
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

        {/* Tab bar */}
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabClick={switchTab}
          onTabClose={closeTab}
        />

        {/* Content area */}
        <div className="flex-1 overflow-auto p-6">
          {contentLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
          ) : activeTab && fileContent !== null ? (
            <MarkdownView
              content={fileContent}
              onLinkClick={handleLinkClick}
              onCheckboxChange={handleCheckboxChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">
                Select a file to view
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
