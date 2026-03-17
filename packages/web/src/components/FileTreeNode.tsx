import { useState, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  FolderOpen,
  FolderClosed,
  FolderPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab, FileTreeEntry } from '@/lib/api';

interface FileTreeNodeProps {
  entry: FileTreeEntry;
  projectId: string;
  activeTab: Tab | null;
  depth: number;
  onFileClick: (projectId: string, filePath: string) => void;
  onCreateFolder?: (projectId: string, folderPath: string) => void;
  draggable?: boolean;
  onFolderDragStart?: () => void;
  onFolderDragEnd?: () => void;
}

export function FileTreeNode({
  entry,
  projectId,
  activeTab,
  depth,
  onFileClick,
  onCreateFolder,
  draggable,
  onFolderDragStart,
  onFolderDragEnd,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [subfolderName, setSubfolderName] = useState('');
  const subfolderInputRef = useRef<HTMLInputElement>(null);

  const isActive =
    entry.type === 'file' &&
    activeTab?.projectId === projectId &&
    activeTab?.filePath === entry.path;

  function submitSubfolder() {
    const name = subfolderName.trim();
    if (name && onCreateFolder) {
      onCreateFolder(projectId, `${entry.path}/${name}`);
    }
    setCreatingSubfolder(false);
    setSubfolderName('');
  }

  if (entry.type === 'directory') {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(
            'application/x-ezmdv-folder',
            JSON.stringify({ projectId, folderPath: entry.path, folderName: entry.name }),
          );
          e.dataTransfer.effectAllowed = 'move';
          onFolderDragStart?.();
        }}
        onDragEnd={() => onFolderDragEnd?.()}
      >
        <div className="group flex items-center">
          <button
            className="flex flex-1 items-center gap-1.5 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
          {onCreateFolder && (
            <button
              className="mr-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              title="Create subfolder"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
                setCreatingSubfolder(true);
                setSubfolderName('');
                setTimeout(() => subfolderInputRef.current?.focus(), 0);
              }}
            >
              <FolderPlus className="size-3.5" />
            </button>
          )}
        </div>
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
                onCreateFolder={onCreateFolder}
                draggable={draggable}
                onFolderDragStart={onFolderDragStart}
                onFolderDragEnd={onFolderDragEnd}
              />
            ))}
            {creatingSubfolder && (
              <form
                className="flex items-center gap-1 py-0.5"
                style={{ paddingLeft: `${(depth + 1) * 12 + 8}px`, paddingRight: '8px' }}
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSubfolder();
                }}
              >
                <input
                  ref={subfolderInputRef}
                  value={subfolderName}
                  onChange={(e) => setSubfolderName(e.target.value)}
                  placeholder="new-folder"
                  className="h-6 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                  onBlur={submitSubfolder}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setCreatingSubfolder(false);
                      setSubfolderName('');
                    }
                  }}
                />
              </form>
            )}
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
      draggable={draggable}
      onDragStart={draggable ? (e) => {
        e.dataTransfer.setData(
          'application/x-ezmdv-file',
          JSON.stringify({ projectId, filePath: entry.path, fileName: entry.name }),
        );
        e.dataTransfer.effectAllowed = 'move';
      } : undefined}
    >
      <File className="size-3.5 shrink-0 text-blue-500" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}
