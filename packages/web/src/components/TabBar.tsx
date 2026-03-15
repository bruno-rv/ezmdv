import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab } from '@/lib/api';

interface TabBarProps {
  tabs: Tab[];
  activeTab: Tab | null;
  onTabClick: (projectId: string, filePath: string) => void;
  onTabClose: (projectId: string, filePath: string) => void;
}

// Generate a consistent color index for a project ID
const PROJECT_COLORS = [
  'border-blue-500',
  'border-emerald-500',
  'border-amber-500',
  'border-purple-500',
  'border-rose-500',
  'border-cyan-500',
  'border-orange-500',
  'border-teal-500',
];

function getProjectColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = ((hash << 5) - hash + projectId.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export function TabBar({
  tabs,
  activeTab,
  onTabClick,
  onTabClose,
}: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      className="flex border-b border-border bg-muted/30 overflow-x-auto"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive =
          activeTab?.projectId === tab.projectId &&
          activeTab?.filePath === tab.filePath;
        const colorClass = getProjectColor(tab.projectId);

        return (
          <div
            key={`${tab.projectId}:${tab.filePath}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-b-2 transition-colors shrink-0',
              isActive
                ? `${colorClass} bg-background text-foreground`
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
            onClick={() => onTabClick(tab.projectId, tab.filePath)}
          >
            <span className="truncate max-w-[150px]">
              {getFileName(tab.filePath)}
            </span>
            <button
              className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.projectId, tab.filePath);
              }}
              aria-label={`Close ${getFileName(tab.filePath)}`}
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
