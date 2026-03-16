import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/MarkdownView';

const noop = () => {};

interface GraphPreviewModalProps {
  filePath: string;
  content: string;
  onClose: () => void;
}

export function GraphPreviewModal({ filePath, content, onClose }: GraphPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex h-[80vh] w-[75vw] max-w-4xl flex-col rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <span className="truncate text-sm font-medium">
            {filePath.split('/').pop()}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
          <MarkdownView
            content={content}
            onLinkClick={noop}
          />
        </div>
      </div>
    </div>
  );
}
