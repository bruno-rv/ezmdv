import { useState, useEffect, useRef } from 'react';
import { Play, Pause, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AutoScrollControlsProps {
  active: boolean;
  intervalSeconds: number;
  scrollPercent: number;
  onToggle: () => void;
  onIntervalChange: (seconds: number) => void;
  onPercentChange: (percent: number) => void;
}

export function AutoScrollControls({
  active,
  intervalSeconds,
  scrollPercent,
  onToggle,
  onIntervalChange,
  onPercentChange,
}: AutoScrollControlsProps) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPopover) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPopover]);

  return (
    <div className="relative flex items-center" ref={popoverRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={active ? 'Pause autoscroll' : 'Start autoscroll'}
        title={active ? 'Pause autoscroll' : 'Start autoscroll (Ctrl+Shift+A)'}
        className="relative"
      >
        {active ? <Pause className="size-4" /> : <Play className="size-4" />}
        {active && (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-blue-500" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation();
          setShowPopover((prev) => !prev);
        }}
        aria-label="Autoscroll settings"
        title="Autoscroll settings"
        className="size-5"
      >
        <ChevronDown className={cn('size-3 transition-transform', showPopover && 'rotate-180')} />
      </Button>

      {showPopover && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-popover p-3 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Speed</label>
                <span className="text-xs font-mono text-foreground">{intervalSeconds}s</span>
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
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1s (fast)</span>
                <span>120s (slow)</span>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Scroll amount (% viewport)</label>
                <span className="text-xs font-mono text-foreground">{scrollPercent}%</span>
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
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
