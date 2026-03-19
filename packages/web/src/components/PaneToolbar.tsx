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
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Save,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditableZoomPercent } from '@/components/EditableZoomPercent';
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">
      {children}
    </div>
  );
}

interface AutoScrollInlineProps {
  active: boolean;
  intervalSeconds: number;
  scrollPercent: number;
  onToggle: () => void;
  onIntervalChange: (v: number) => void;
  onPercentChange: (v: number) => void;
}

function AutoScrollInline({
  active,
  intervalSeconds,
  scrollPercent,
  onToggle,
  onIntervalChange,
  onPercentChange,
}: AutoScrollInlineProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          className={cn(
            'flex flex-1 items-center gap-2 rounded-md py-0.5 text-xs transition-colors',
            'hover:text-accent-foreground',
            active && 'text-accent-foreground',
          )}
          onClick={onToggle}
        >
          <span className="relative shrink-0 [&_svg]:size-3.5">
            {active ? <Pause /> : <Play />}
            {active && (
              <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-blue-500" />
            )}
          </span>
          <span className="flex-1 text-left">Autoscroll</span>
        </button>
        <span className="text-[10px] text-muted-foreground">⌘⇧A</span>
        <button
          className="rounded p-0.5 hover:bg-accent transition-colors"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label="Autoscroll settings"
        >
          <ChevronDown className={cn('size-3 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 px-2 pb-2 pt-1">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground">Speed</label>
              <span className="text-[10px] font-mono text-foreground">{intervalSeconds}s</span>
            </div>
            <input
              type="range"
              min={1}
              max={120}
              step={1}
              value={intervalSeconds}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>1s (fast)</span>
              <span>120s (slow)</span>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[10px] text-muted-foreground">Scroll amount</label>
              <span className="text-[10px] font-mono text-foreground">{scrollPercent}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={scrollPercent}
              onChange={(e) => onPercentChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>1%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
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
  onZoomSet: (value: number) => void;
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
    onZoomSet,
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

      {/* File badge */}
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="truncate max-w-[200px]">{filePath.split('/').pop()}</span>
      </span>

      <span className="min-w-0 flex-1" />

      {/* Mode indicator */}
      {!isFullscreen && (
        <span className="inline-flex rounded-lg bg-muted/50 p-0.5">
          <span className="rounded-md bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground shadow-sm">
            {editMode ? 'EDIT' : splitContext ? 'SPLIT' : 'RAW'}
          </span>
        </span>
      )}

      {/* Right side: grouped icons - hidden until hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover/toolbar:opacity-100 transition-opacity duration-200">
        {showViewGroup && (
          <ToolbarGroup
            icon={<SlidersHorizontal className="size-4" />}
            label="Panels"
            hasActiveChild={tocOpen || backlinksOpen || isFullscreen || zoom !== 1}
          >
            {/* Edit */}
            {!editMode && !previewOnly && !splitContext && (
              <ToolbarItem
                icon={<Pencil />}
                label="Edit"
                shortcut="⌘E"
                onClick={onEdit}
              />
            )}
            {/* Panels */}
            {showPanelActions && (
              <>
                <SectionHeader>Panels</SectionHeader>
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
            <SectionHeader>View</SectionHeader>
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
            {/* Zoom */}
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Zoom</span>
              <div className="flex items-center gap-1">
                <button
                  className="rounded p-0.5 hover:bg-accent transition-colors"
                  onClick={(e) => { e.stopPropagation(); onZoomOut(); }}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <EditableZoomPercent
                  zoom={zoom}
                  min={0.5}
                  max={2}
                  onZoomSet={onZoomSet}
                  onZoomReset={onZoomReset}
                  className="text-[11px]"
                />
                <button
                  className="rounded p-0.5 hover:bg-accent transition-colors"
                  onClick={(e) => { e.stopPropagation(); onZoomIn(); }}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="size-3.5" />
                </button>
              </div>
            </div>
            {/* Autoscroll — inline */}
            {showPanelActions && (
              <AutoScrollInline
                active={autoScroll.active}
                intervalSeconds={autoScroll.intervalSeconds}
                scrollPercent={autoScroll.scrollPercent}
                onToggle={autoScroll.toggle}
                onIntervalChange={autoScroll.setIntervalSeconds}
                onPercentChange={autoScroll.setScrollPercent}
              />
            )}
          </ToolbarGroup>
        )}

        {/* Edit mode action buttons */}
        {showEditActions ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onSaveAndPreview(); }}
              aria-label="Live preview"
              title="Toggle live preview"
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
        ) : null}
      </div>
    </div>
  );
}
