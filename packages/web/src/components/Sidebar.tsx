import { useState, useRef, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  FolderOpen,
  FolderClosed,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { ProjectWithFiles } from '@/hooks/useProjects';
import type { FileTreeEntry, Tab } from '@/lib/api';

interface SidebarProps {
  projects: ProjectWithFiles[];
  activeTab: Tab | null;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onFileClick: (projectId: string, filePath: string) => void;
  onExpandProject: (projectId: string) => void;
  onUploadFiles: (files: FileList, relativePaths?: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
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
          className={cn(
            'flex w-full items-center gap-1.5 py-1 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
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
        'flex w-full items-center gap-1.5 py-1 px-2 text-sm rounded transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
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
  onUploadFiles,
  isOpen,
  onClose,
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onUploadFiles(files);
      }
      // Reset input
      e.target.value = '';
      setShowUploadMenu(false);
    },
    [onUploadFiles],
  );

  const handleFolderUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const relativePaths: string[] = [];
        for (let i = 0; i < files.length; i++) {
          relativePaths.push(files[i].webkitRelativePath || files[i].name);
        }
        onUploadFiles(files, relativePaths);
      }
      // Reset input
      e.target.value = '';
      setShowUploadMenu(false);
    },
    [onUploadFiles],
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed md:static z-50 top-0 left-0 h-full w-[280px] flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h1 className="text-lg font-bold tracking-tight">ezmdv</h1>
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {projects.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground text-center">
              No projects yet. Upload markdown files to get started.
            </p>
          ) : (
            projects.map((project) => {
              const isExpanded = expandedProjects[project.id] ?? false;
              return (
                <div key={project.id} className="mb-1">
                  <button
                    className="flex w-full items-center gap-1.5 py-1.5 px-2 text-sm font-medium hover:bg-muted/50 rounded transition-colors"
                    onClick={() => toggleProject(project.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4 shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{project.name}</span>
                  </button>

                  {isExpanded && (
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

        {/* Upload button */}
        <div className="relative border-t border-border p-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setShowUploadMenu(!showUploadMenu)}
          >
            <Upload className="size-4" />
            Upload MD
          </Button>

          {showUploadMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <File className="size-4" />
                Upload Files
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
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
      </aside>
    </>
  );
}
