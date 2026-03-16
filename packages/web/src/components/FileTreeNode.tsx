import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  FolderOpen,
  FolderClosed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab, FileTreeEntry } from '@/lib/api';

interface FileTreeNodeProps {
  entry: FileTreeEntry;
  projectId: string;
  activeTab: Tab | null;
  depth: number;
  onFileClick: (projectId: string, filePath: string) => void;
}

export function FileTreeNode({
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
          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
        'flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors',
        isActive
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onFileClick(projectId, entry.path)}
    >
      <File className="size-3.5 shrink-0 text-blue-500" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}
