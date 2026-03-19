import { ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/MarkdownView';
import { EditableZoomPercent } from '@/components/EditableZoomPercent';

const noop = () => {};

interface GraphPreviewModalProps {
  filePath: string;
  content: string;
  zoom: number;
  projectId?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomSet: (value: number) => void;
  onZoomReset: () => void;
  onClose: () => void;
}

export function GraphPreviewModal({
  filePath,
  content,
  zoom,
  projectId,
  onZoomIn,
  onZoomOut,
  onZoomSet,
  onZoomReset,
  onClose,
}: GraphPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex h-[80vh] w-[75vw] max-w-4xl flex-col rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <span className="truncate text-sm font-medium">
            {filePath.split('/').pop()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onZoomOut}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut className="size-4" />
            </Button>
            <EditableZoomPercent
              zoom={zoom}
              min={0.5}
              max={2}
              onZoomSet={onZoomSet}
              onZoomReset={onZoomReset}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onZoomIn}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn className="size-4" />
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
          <MarkdownView
            content={content}
            zoom={zoom}
            projectId={projectId}
            onLinkClick={noop}
          />
        </div>
      </div>
    </div>
  );
}
