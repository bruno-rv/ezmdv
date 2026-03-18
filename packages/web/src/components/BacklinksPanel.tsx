import { cn } from '@/lib/utils';

export interface Backlink {
  sourceFile: string;
  linkText: string;
  context: string;
}

interface BacklinksPanelProps {
  backlinks: Backlink[];
  loading: boolean;
  onFileClick: (filePath: string) => void;
}

export function BacklinksPanel({ backlinks, loading, onFileClick }: BacklinksPanelProps) {
  if (loading) {
    return (
      <div className="p-3 text-xs text-muted-foreground">Loading backlinks...</div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">No backlinks found</div>
    );
  }

  return (
    <div className="flex flex-col overflow-y-auto py-2">
      {backlinks.map((bl) => {
        const fileName = bl.sourceFile.split('/').pop() ?? bl.sourceFile;
        return (
          <button
            key={`${bl.sourceFile}:${bl.linkText}`}
            className="flex flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
            onClick={() => onFileClick(bl.sourceFile)}
          >
            <span className="text-xs font-medium text-primary truncate">{fileName}</span>
            <span className="text-[11px] text-muted-foreground line-clamp-2">
              {bl.context}
            </span>
          </button>
        );
      })}
    </div>
  );
}
