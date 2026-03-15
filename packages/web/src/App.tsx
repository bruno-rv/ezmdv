import { useState, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/Sidebar';
import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/hooks/useTheme';
import { useProjects } from '@/hooks/useProjects';
import { useTabs } from '@/hooks/useTabs';
import { fetchFileContent, uploadFiles } from '@/lib/api';

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    projects,
    loadProjects,
    loadProjectFiles,
    addProject,
  } = useProjects();
  const { tabs, activeTab, openTab, closeTab, switchTab } = useTabs();

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

  const handleFileClick = useCallback(
    (projectId: string, filePath: string) => {
      openTab(projectId, filePath);
      setSidebarOpen(false); // Close sidebar on mobile after click
    },
    [openTab],
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

        // Use a temp path — the server handles creating the upload dir
        const project = await addProject({
          name: projectName,
          path: `/tmp/ezmdv-upload-${Date.now()}`,
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
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {fileContent}
            </pre>
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
