import { type FileMetadata } from '@/lib/api';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface FileMetaTooltipProps {
  data: FileMetadata;
}

export function FileMetaTooltip({ data }: FileMetaTooltipProps) {
  return (
    <div
      className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-md border border-border bg-popover p-3 shadow-lg"
    >
      <div className="space-y-1 text-xs">
        <div className="font-medium text-foreground">{data.fileName}</div>
        <div className="text-muted-foreground">{formatSize(data.sizeBytes)} · {data.lineCount} lines</div>
        <div className="pt-1 text-muted-foreground">
          <div>Created: {new Date(data.createdAt).toLocaleString()}</div>
          <div>Modified: {new Date(data.modifiedAt).toLocaleString()}</div>
          <div>Owner: {data.owner}</div>
        </div>
      </div>
    </div>
  );
}
