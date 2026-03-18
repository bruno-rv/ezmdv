import { cn } from '@/lib/utils';

type ViewMode = 'raw' | 'edit' | 'split';

interface ModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  editDisabled?: boolean;
  splitDisabled?: boolean;
}

export function ModeToggle({
  mode,
  onModeChange,
  editDisabled,
  splitDisabled,
}: ModeToggleProps) {
  return (
    <div className="inline-flex rounded-lg bg-muted/50 p-0.5">
      {([
        { value: 'raw' as const, label: 'RAW', disabled: false },
        { value: 'edit' as const, label: 'EDIT', disabled: editDisabled },
        { value: 'split' as const, label: 'SPLIT', disabled: splitDisabled },
      ]).map(({ value, label, disabled }) => (
        <button
          key={value}
          className={cn(
            'px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all',
            mode === value
              ? 'rounded-md bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'pointer-events-none opacity-40',
          )}
          onClick={() => !disabled && onModeChange(value)}
          disabled={disabled}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
