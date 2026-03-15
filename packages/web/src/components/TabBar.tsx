import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab } from '@/lib/api';

interface TabBarProps {
  tabs: Tab[];
  activeTab: Tab | null;
  primaryTab: Tab | null;
  secondaryTab: Tab | null;
  splitView: boolean;
  onTabClick: (projectId: string, filePath: string) => void;
  onTabClose: (projectId: string, filePath: string) => void;
}

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

function isSameTab(a: Tab | null, b: Tab): boolean {
  return Boolean(
    a &&
      a.projectId === b.projectId &&
      a.filePath === b.filePath,
  );
}

export function TabBar({
  tabs,
  activeTab,
  primaryTab,
  secondaryTab,
  splitView,
  onTabClick,
  onTabClose,
}: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      className="flex overflow-x-auto border-b border-border bg-muted/30"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = isSameTab(activeTab, tab);
        const isPrimary = isSameTab(primaryTab, tab);
        const isSecondary = isSameTab(secondaryTab, tab);
        const isVisibleInPane = isPrimary || isSecondary;
        const colorClass = getProjectColor(tab.projectId);

        return (
          <div
            key={`${tab.projectId}:${tab.filePath}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'group flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm transition-colors',
              isActive
                ? `${colorClass} bg-background text-foreground`
                : isVisibleInPane
                  ? 'border-border bg-background/70 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            onClick={() => onTabClick(tab.projectId, tab.filePath)}
          >
            <span className="truncate max-w-[150px]">
              {getFileName(tab.filePath)}
            </span>

            {splitView && isVisibleInPane && (
              <span
                className={cn(
                  'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  isActive
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-muted/60 text-muted-foreground',
                )}
              >
                {isPrimary ? 'L' : 'R'}
              </span>
            )}

            <button
              className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
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
