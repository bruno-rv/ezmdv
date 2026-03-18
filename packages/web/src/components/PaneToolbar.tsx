import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronDown,
  Columns2,
  Eye,
  Info,
  Link2,
  List,
  Maximize2,
  Minimize2,
  Pencil,
  RefreshCw,
  Save,
  ZoomIn,
  ZoomOut,
  LayoutDashboard,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoScrollControls } from '@/components/AutoScrollControls';
import { cn } from '@/lib/utils';

interface ToolbarGroupProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  hasActiveChild?: boolean;
}

function ToolbarGroup({ icon, label, children, hasActiveChild }: ToolbarGroupProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={label}
        title={label}
        className={cn(
          'transition-colors',
          (open || hasActiveChild) && 'bg-muted text-foreground',
        )}
      >
        <span className="flex items-center">
          {icon}
          <ChevronDown className={cn(
            'ml-0.5 size-2.5 transition-transform',
            open && 'rotate-180',
          )} />
        </span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          {children}
        </div>
      )}
    </div>
  );
}

interface ToolbarItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function ToolbarItem({ icon, label, shortcut, active, disabled, onClick }: ToolbarItemProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent/50 text-accent-foreground',
        disabled && 'opacity-50 pointer-events-none',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      disabled={disabled}
    >
      <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-[10px] text-muted-foreground">{shortcut}</span>
      )}
    </button>
  );
}

export interface PaneToolbarProps {
  editMode: boolean;
  previewOnly: boolean;
  pane: 'primary' | 'secondary';
  splitContext: boolean;
  isFocused: boolean;
  isFullscreen: boolean;
  tocOpen: boolean;
  backlinksOpen: boolean;
  zoom: number;
  isDirty: boolean;
  saving: boolean;
  filePath: string;
  autoScroll: {
    active: boolean;
    intervalSeconds: number;
    scrollPercent: number;
    toggle: () => void;
    setIntervalSeconds: (v: number) => void;
    setScrollPercent: (v: number) => void;
  };
  onRefresh: () => void;
  onToggleToc: () => void;
  onToggleBacklinks: () => void;
  onFileInfo: () => void;
  metaTooltipContent: React.ReactNode | null;
  onCloseSplit: () => void;
  onFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onSave: () => void;
  onSaveAndPreview: () => void;
  onSplitView: () => void;
  onEdit: () => void;
}

export function PaneToolbar(props: PaneToolbarProps) {
  const {
    editMode,
    previewOnly,
    pane,
    splitContext,
    isFocused,
    isFullscreen,
    tocOpen,
    backlinksOpen,
    zoom,
    isDirty,
    saving,
    filePath,
    autoScroll,
    onRefresh,
    onToggleToc,
    onToggleBacklinks,
    onFileInfo,
    metaTooltipContent,
    onCloseSplit,
    onFullscreen,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onSave,
    onSaveAndPreview,
    onSplitView,
    onEdit,
  } = props;

  const showViewGroup = !editMode;
  const showEditActions = editMode && !previewOnly;
  const isPrimary = pane === 'primary';
  const showPanelActions = isPrimary && !previewOnly && !editMode;

  return (
    <div className="group/toolbar relative flex items-center gap-1 border-b border-border px-4 py-2">
      {/* Left: split context label */}
      {splitContext && (
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
            isFocused
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-muted/60 text-muted-foreground',
          )}
        >
          {pane === 'primary' ? 'Left' : 'Right'}
        </span>
      )}

      {/* File path */}
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {filePath}
      </span>

      {/* Right side: grouped icons - hidden until hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover/toolbar:opacity-100 transition-opacity duration-200">
        {/* View group: zoom, fullscreen, refresh, split */}
        {showViewGroup && (
          <ToolbarGroup
            icon={<LayoutDashboard className="size-4" />}
            label="View"
            hasActiveChild={isFullscreen || zoom !== 1}
          >
            <ToolbarItem
              icon={<RefreshCw />}
              label="Refresh from disk"
              shortcut="⌘⇧R"
              onClick={onRefresh}
            />
            {(!editMode || previewOnly) && (
              <ToolbarItem
                icon={isFullscreen ? <Minimize2 /> : <Maximize2 />}
                label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                shortcut="Esc"
                onClick={onFullscreen}
              />
            )}
            {!splitContext && !editMode && (
              <ToolbarItem
                icon={<Columns2 />}
                label="Split view"
                onClick={onSplitView}
              />
            )}
            {splitContext && (
              <ToolbarItem
                icon={<Columns2 />}
                label="Close split"
                onClick={onCloseSplit}
              />
            )}
            <div className="my-1 h-px bg-border" />
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs text-muted-foreground">Zoom</span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded p-0.5 hover:bg-accent transition-colors"
                  onClick={(e) => { e.stopPropagation(); onZoomOut(); }}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <button
                  className="min-w-[2.5rem] text-center text-[11px] text-muted-foreground tabular-nums select-none hover:text-foreground"
                  onDoubleClick={(e) => { e.stopPropagation(); onZoomReset(); }}
                  title="Double-click to reset"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  className="rounded p-0.5 hover:bg-accent transition-colors"
                  onClick={(e) => { e.stopPropagation(); onZoomIn(); }}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="size-3.5" />
                </button>
              </div>
            </div>
          </ToolbarGroup>
        )}

        {/* Panels group: TOC, backlinks, info */}
        {showViewGroup && (
          <ToolbarGroup
            icon={<SlidersHorizontal className="size-4" />}
            label="Panels"
            hasActiveChild={tocOpen || backlinksOpen}
          >
            {showPanelActions && (
              <>
                <ToolbarItem
                  icon={<List />}
                  label="Table of contents"
                  shortcut="⌘⇧T"
                  active={tocOpen}
                  onClick={onToggleToc}
                />
                <ToolbarItem
                  icon={<Link2 />}
                  label="Backlinks"
                  active={backlinksOpen}
                  onClick={onToggleBacklinks}
                />
              </>
            )}
            <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
              <ToolbarItem
                icon={<Info />}
                label="File info"
                onClick={onFileInfo}
              />
              {metaTooltipContent}
            </div>
            {showPanelActions && (
              <>
                <div className="my-1 h-px bg-border" />
                <div className="px-2 py-1">
                  <AutoScrollControls
                    active={autoScroll.active}
                    intervalSeconds={autoScroll.intervalSeconds}
                    scrollPercent={autoScroll.scrollPercent}
                    onToggle={autoScroll.toggle}
                    onIntervalChange={autoScroll.setIntervalSeconds}
                    onPercentChange={autoScroll.setScrollPercent}
                  />
                </div>
              </>
            )}
          </ToolbarGroup>
        )}

        {/* Always-visible action buttons */}
        {showEditActions ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onSaveAndPreview(); }}
              disabled={saving}
              aria-label="Save and preview"
              title="Save and preview (Ctrl+E)"
            >
              <Eye className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onSave(); }}
              disabled={saving || !isDirty}
              aria-label="Save"
              title="Save (Ctrl+S)"
            >
              <Save className="size-4" />
            </Button>
            {isDirty && (
              <span className="text-xs font-medium text-amber-500">Unsaved</span>
            )}
          </>
        ) : !editMode ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label="Edit file"
            title="Edit (Ctrl+E)"
          >
            <Pencil className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
