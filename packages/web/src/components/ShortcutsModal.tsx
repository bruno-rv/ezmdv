import { Fragment, useEffect, useState, useCallback } from 'react';
import { Pencil, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SHORTCUT_DEFS,
  EDITOR_SHORTCUTS,
  GRAPH_SHORTCUTS,
  formatBindingForDisplay,
  bindingFromEvent,
  getEffectiveBindings,
} from '@/lib/shortcuts';

interface ShortcutsModalProps {
  onClose: () => void;
  keyboardShortcuts: Record<string, string>;
  onUpdateShortcut: (id: string, binding: string) => void;
  onResetShortcut: (id: string) => void;
}

export function ShortcutsModal({
  onClose,
  keyboardShortcuts,
  onUpdateShortcut,
  onResetShortcut,
}: ShortcutsModalProps) {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (recordingId) return; // handled below
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, recordingId]);

  const handleRecordKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingId) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingId(null);
        setConflict(null);
        return;
      }

      // Ignore lone modifier keys
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return;

      const newBinding = bindingFromEvent(e);
      const effectiveBindings = getEffectiveBindings(keyboardShortcuts);

      // Check for conflicts
      const conflictDef = SHORTCUT_DEFS.find(
        (def) => def.id !== recordingId && effectiveBindings.get(def.id) === newBinding,
      );

      if (conflictDef) {
        setConflict(`Conflicts with "${conflictDef.description}"`);
        return;
      }

      onUpdateShortcut(recordingId, newBinding);
      setRecordingId(null);
      setConflict(null);
    },
    [recordingId, keyboardShortcuts, onUpdateShortcut],
  );

  useEffect(() => {
    if (!recordingId) return;
    window.addEventListener('keydown', handleRecordKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleRecordKeyDown, { capture: true });
  }, [recordingId, handleRecordKeyDown]);

  const effectiveBindings = getEffectiveBindings(keyboardShortcuts);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => {
        if (recordingId) { setRecordingId(null); setConflict(null); return; }
        onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close shortcuts">
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actions
            </p>
            <div className="grid grid-cols-[1fr_auto] gap-y-1">
              {SHORTCUT_DEFS.filter((d) => d.customizable).map((def) => {
                const binding = effectiveBindings.get(def.id) ?? def.defaultBinding;
                const isRecording = recordingId === def.id;
                const hasOverride = Boolean(keyboardShortcuts[def.id]);

                return (
                  <Fragment key={def.id}>
                    <div className="flex items-center gap-2 py-0.5">
                      <span className="text-sm text-muted-foreground">{def.description}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isRecording ? (
                        <span className="animate-pulse rounded border border-primary/50 bg-primary/10 px-2 py-0.5 text-xs font-mono text-primary">
                          {conflict ?? 'Press keys…'}
                        </span>
                      ) : (
                        <kbd className="whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {formatBindingForDisplay(binding)}
                        </kbd>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setConflict(null);
                          setRecordingId(isRecording ? null : def.id);
                        }}
                        aria-label={isRecording ? 'Cancel recording' : `Edit shortcut for ${def.description}`}
                        title={isRecording ? 'Cancel (Esc)' : 'Edit'}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      {hasOverride && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onResetShortcut(def.id)}
                          aria-label={`Reset shortcut for ${def.description}`}
                          title="Reset to default"
                        >
                          <RotateCcw className="size-3" />
                        </Button>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Non-customizable
            </p>
            <div className="grid grid-cols-[1fr_auto] gap-y-1">
              {SHORTCUT_DEFS.filter((d) => !d.customizable).map((def) => (
                <Fragment key={def.id}>
                  <span className="py-0.5 text-sm text-muted-foreground">{def.description}</span>
                  <kbd className="self-center whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {formatBindingForDisplay(def.defaultBinding)}
                  </kbd>
                </Fragment>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Editor
            </p>
            <div className="grid grid-cols-[1fr_auto] gap-y-1">
              {EDITOR_SHORTCUTS.map(({ key, description }) => (
                <Fragment key={key}>
                  <span className="py-0.5 text-sm text-muted-foreground">{description}</span>
                  <kbd className="self-center whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {formatBindingForDisplay(key)}
                  </kbd>
                </Fragment>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Graph
            </p>
            <div className="grid grid-cols-[1fr_auto] gap-y-1">
              {GRAPH_SHORTCUTS.map(({ key, description }) => (
                <Fragment key={key}>
                  <span className="py-0.5 text-sm text-muted-foreground">{description}</span>
                  <kbd className="self-center whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {key}
                  </kbd>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
