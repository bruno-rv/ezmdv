import {
  Search,
  Maximize2,
  Settings,
  Share2,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AppMode = 'edit' | 'visualize';

interface TopHeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  zoom: number;
  onSearchClick: () => void;
  onSettingsClick: () => void;
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export function TopHeader({
  mode,
  onModeChange,
  zoom,
  onSearchClick,
  onSettingsClick,
  onMenuClick,
  showMenu,
}: TopHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4">
      {/* Left: logo + mode tabs */}
      <div className="flex items-center gap-4">
        {showMenu && onMenuClick && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onMenuClick}
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </Button>
        )}
        <span className="text-base font-bold tracking-tight">ezmdv</span>
        <nav className="hidden items-center gap-1 md:flex">
          <button
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'edit'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onModeChange('edit')}
          >
            Edit
          </button>
          <button
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              mode === 'visualize'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onModeChange('visualize')}
          >
            Visualize
          </button>
        </nav>
      </div>

      {/* Center: search bar */}
      <div className="mx-4 hidden max-w-lg flex-1 md:block">
        <button
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50"
          onClick={onSearchClick}
        >
          <Search className="size-4 shrink-0" />
          <span>Search files or commands...</span>
          <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: zoom + actions */}
      <div className="ml-auto flex items-center gap-1">
        {zoom !== 1 && (
          <span className="mr-1 rounded bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zoom {Math.round(zoom * 100)}%
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSettingsClick}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="size-4" />
        </Button>
      </div>
    </header>
  );
}
