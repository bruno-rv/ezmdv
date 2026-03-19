import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface EditableZoomPercentProps {
  zoom: number;
  min: number;
  max: number;
  onZoomSet: (newZoom: number) => void;
  onZoomReset?: () => void;
  className?: string;
}

export function EditableZoomPercent({
  zoom,
  min,
  max,
  onZoomSet,
  onZoomReset,
  className,
}: EditableZoomPercentProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed / 100));
      onZoomSet(clamped);
    }
    setEditing(false);
  }, [inputValue, min, max, onZoomSet]);

  const cancel = useCallback(() => {
    setEditing(false);
  }, []);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        className={cn(
          'min-w-[3rem] w-[3.5rem] text-center text-xs tabular-nums bg-transparent border border-primary rounded px-1 py-0 outline-none',
          className,
        )}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value.replace(/[^0-9]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') cancel();
          e.stopPropagation();
        }}
        onBlur={commit}
      />
    );
  }

  return (
    <button
      className={cn(
        'min-w-[3rem] text-center text-xs text-muted-foreground tabular-nums select-none hover:text-foreground cursor-text',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        setInputValue(String(Math.round(zoom * 100)));
        setEditing(true);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onZoomReset?.();
      }}
      title="Click to edit, double-click to reset"
    >
      {Math.round(zoom * 100)}%
    </button>
  );
}
