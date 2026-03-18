import { useEffect, useRef } from 'react';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Code, Quote, Minus, Table, ImageIcon, Link, Bold, Italic, AlertCircle,
} from 'lucide-react';
import type { SlashCommand } from '@/lib/slashCommands';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'heading-1': Heading1,
  'heading-2': Heading2,
  'heading-3': Heading3,
  list: List,
  'list-ordered': ListOrdered,
  'check-square': CheckSquare,
  code: Code,
  quote: Quote,
  minus: Minus,
  table: Table,
  image: ImageIcon,
  link: Link,
  bold: Bold,
  italic: Italic,
  'alert-circle': AlertCircle,
};

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (command: SlashCommand) => void;
}

export function SlashCommandMenu({ commands, selectedIndex, position, onSelect }: SlashCommandMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={listRef}
      className="absolute z-50 w-64 max-h-[300px] overflow-y-auto bg-popover border border-border rounded-lg shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {commands.map((cmd, i) => {
        const Icon = iconMap[cmd.icon];
        return (
          <button
            key={cmd.label}
            ref={i === selectedIndex ? selectedRef : undefined}
            className={`flex items-center gap-3 w-full px-3 py-2 text-left text-sm transition-colors ${
              i === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(cmd);
            }}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <div className="font-medium truncate">{cmd.label}</div>
              <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
