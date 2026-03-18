import { cn } from '@/lib/utils';

interface StatusBarProps {
  connected: boolean;
  editMode: boolean;
  splitView: boolean;
  content: string | null;
  filePath: string | null;
}

export function StatusBar({
  connected,
  editMode,
  splitView,
  content,
  filePath,
}: StatusBarProps) {
  const wordCount = content
    ? content.split(/\s+/).filter(Boolean).length
    : 0;

  const modeLabel = editMode
    ? 'Editing'
    : splitView
      ? 'Side-by-Side Reading'
      : 'Viewing';

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-muted/20 px-4 text-[10px] uppercase tracking-wider text-muted-foreground">
      {/* Left */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'size-1.5 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
          {connected ? 'Synced' : 'Offline'}
        </span>
        <span>UTF-8</span>
        <span>LF</span>
      </div>

      {/* Center */}
      <span>{modeLabel}</span>

      {/* Right */}
      <div className="flex items-center gap-3">
        {content !== null && (
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        )}
        {filePath && (
          <span className="max-w-[200px] truncate normal-case">{filePath}</span>
        )}
      </div>
    </div>
  );
}
