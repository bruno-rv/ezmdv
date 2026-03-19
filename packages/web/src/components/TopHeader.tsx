import {
  Search,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopHeaderProps {
  zoom: number;
  onSearchClick: () => void;
  onMenuClick?: () => void;
  showMenu?: boolean;
}

export function TopHeader({
  zoom,
  onSearchClick,
  onMenuClick,
  showMenu,
}: TopHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4">
      {/* Left: logo + search */}
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
        <div className="hidden max-w-lg md:block">
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
      </div>

      {/* Right: zoom indicator */}
      <div className="ml-auto flex items-center gap-1">
        {zoom !== 1 && (
          <span className="mr-1 rounded bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Zoom {Math.round(zoom * 100)}%
          </span>
        )}
      </div>
    </header>
  );
}
