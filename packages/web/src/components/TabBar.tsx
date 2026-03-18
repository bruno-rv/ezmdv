import { ChevronRight, X } from 'lucide-react';
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

function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

function getBreadcrumbParts(filePath: string): string[] {
  return filePath.split('/');
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
      className="flex items-center overflow-x-auto border-b border-border bg-muted/20 px-2"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = isSameTab(activeTab, tab);
        const isPrimary = isSameTab(primaryTab, tab);
        const isSecondary = isSameTab(secondaryTab, tab);
        const isVisibleInPane = isPrimary || isSecondary;

        if (isActive) {
          const parts = getBreadcrumbParts(tab.filePath);
          return (
            <div
              key={`${tab.projectId}:${tab.filePath}`}
              role="tab"
              aria-selected
              className="group flex shrink-0 items-center gap-0.5 px-1 py-1.5"
            >
              {parts.map((part, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && (
                    <ChevronRight className="size-3 text-muted-foreground/50" />
                  )}
                  {i === parts.length - 1 ? (
                    <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {part}
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {part}
                    </span>
                  )}
                </span>
              ))}

              {splitView && isVisibleInPane && (
                <span
                  className="ml-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                >
                  {isPrimary ? 'L' : 'R'}
                </span>
              )}

              <button
                className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
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
        }

        return (
          <div
            key={`${tab.projectId}:${tab.filePath}`}
            role="tab"
            aria-selected={false}
            className={cn(
              'group flex shrink-0 cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors',
              isVisibleInPane
                ? 'text-foreground/80'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onTabClick(tab.projectId, tab.filePath)}
          >
            <span className="truncate max-w-[120px]">
              {getFileName(tab.filePath)}
            </span>

            {splitView && isVisibleInPane && (
              <span className="rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
