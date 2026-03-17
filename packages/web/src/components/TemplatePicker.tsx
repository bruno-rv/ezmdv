import { useRef, useEffect } from 'react';
import {
  FileText,
  Users,
  BookOpen,
  PenLine,
  Target,
  Bug,
  CalendarDays,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { templates, type Template } from '@/lib/templates';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Users,
  BookOpen,
  PenLine,
  Target,
  Bug,
  CalendarDays,
  ListChecks,
};

interface TemplatePickerProps {
  selected: string;
  onSelect: (template: Template) => void;
  onClose: () => void;
}

export function TemplatePicker({ selected, onSelect, onClose }: TemplatePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
    >
      {templates.map((t) => {
        const Icon = iconMap[t.icon] ?? FileText;
        return (
          <button
            key={t.id}
            type="button"
            className={cn(
              'flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-accent',
              selected === t.id && 'bg-accent/50 font-medium',
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(t);
            }}
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span>{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}
