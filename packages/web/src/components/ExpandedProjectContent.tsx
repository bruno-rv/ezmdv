import { useState, useMemo, useRef, useCallback } from 'react';
import { FilePlus, FolderPlus, Upload, Waypoints } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileTreeNode } from '@/components/FileTreeNode';
import { TemplatePicker } from '@/components/TemplatePicker';
import { cn } from '@/lib/utils';
import type { ProjectWithFiles } from '@/hooks/useProjects';
import type { Tab, FileTreeEntry } from '@/lib/api';
import { templates, formatTemplate, type Template } from '@/lib/templates';

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
  onCreateFile?: (projectId: string, filePath: string, content?: string) => void;
  onCreateFolder?: (projectId: string, folderPath: string) => void;
  onDeleteFile?: (projectId: string, filePath: string) => void;
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
  onDeleteFile,
  onUploadToProject,
  globalFilter,
  draggable,
  onFolderDragStart,
  onFolderDragEnd,
}: ExpandedProjectContentProps) {
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(templates[0]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const createInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const submitNewFile = useCallback(
    (name: string, template: Template) => {
      if (!name || !onCreateFile) return;
      const filePath = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
      const baseName = filePath.replace(/\.md$/i, '');
      const content = formatTemplate(template, {
        date: new Date().toISOString().slice(0, 10),
        filename: baseName,
      });
      onCreateFile(project.id, filePath, content || undefined);
    },
    [onCreateFile, project.id],
  );

  const visibleEntries = useMemo(() => {
    if (!project.files) return [];
    if (globalFilter) return filterEntries(project.files, globalFilter);
    return project.files;
  }, [project.files, globalFilter]);

  return (
    <div className="ml-1 space-y-2">
      {!globalFilter && (
        <div className="flex items-center justify-end gap-0.5 px-3 pt-1">
          {onCreateFile && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setCreatingFile(true);
                setCreatingFolder(false);
                setNewFileName('');
                setSelectedTemplate(templates[0]);
                setShowTemplatePicker(false);
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
      )}

      {creatingFile && onCreateFile && (
        <div className="relative px-3 space-y-1">
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newFileName.trim();
              if (!name) return;
              submitNewFile(name, selectedTemplate);
              setCreatingFile(false);
              setNewFileName('');
              setSelectedTemplate(templates[0]);
              setShowTemplatePicker(false);
            }}
          >
            <input
              ref={createInputRef}
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="new-note.md"
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              onBlur={() => {
                setTimeout(() => {
                  if (showTemplatePicker) return;
                  const name = newFileName.trim();
                  if (name) {
                    submitNewFile(name, selectedTemplate);
                  }
                  setCreatingFile(false);
                  setNewFileName('');
                  setSelectedTemplate(templates[0]);
                  setShowTemplatePicker(false);
                }, 150);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setCreatingFile(false);
                  setNewFileName('');
                  setSelectedTemplate(templates[0]);
                  setShowTemplatePicker(false);
                }
              }}
            />
            <button
              type="button"
              className={cn(
                'h-7 shrink-0 rounded-md border border-border bg-background px-2 text-[10px] font-medium transition-colors hover:bg-muted/50',
                selectedTemplate.id !== 'blank' && 'border-primary/50 text-primary',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                setShowTemplatePicker((prev) => !prev);
              }}
              title="Choose template"
            >
              {selectedTemplate.name}
            </button>
          </form>
          {showTemplatePicker && (
            <TemplatePicker
              selected={selectedTemplate.id}
              onSelect={(t) => {
                setSelectedTemplate(t);
                setShowTemplatePicker(false);
                createInputRef.current?.focus();
              }}
              onClose={() => setShowTemplatePicker(false)}
            />
          )}
        </div>
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
                onDeleteFile={onDeleteFile}
                draggable={draggable}
                onFolderDragStart={onFolderDragStart}
                onFolderDragEnd={onFolderDragEnd}
              />
            ))
          ) : (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              No markdown files found
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
