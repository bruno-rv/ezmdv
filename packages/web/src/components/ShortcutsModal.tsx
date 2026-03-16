import { Fragment, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Ctrl/⌘ + S', description: 'Save file' },
  { key: 'Ctrl/⌘ + E', description: 'Toggle edit mode' },
  { key: 'Ctrl/⌘ + W', description: 'Close focused tab' },
  { key: 'Ctrl/⌘ + ]', description: 'Next tab' },
  { key: 'Ctrl/⌘ + [', description: 'Previous tab' },
  { key: 'Ctrl/⌘ + Shift + A', description: 'Toggle autoscroll' },
  { key: 'Esc', description: 'Exit fullscreen' },
  { key: 'Double-click graph node', description: 'Open file' },
  { key: 'Drag graph node', description: 'Reposition' },
];

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close shortcuts"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {SHORTCUTS.map(({ key, description }) => (
            <Fragment key={key}>
              <kbd className="whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
                {key}
              </kbd>
              <span className="text-sm text-muted-foreground">{description}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
