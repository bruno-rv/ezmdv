import { useState, useCallback, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  level: number;
  children: ReactNode;
  id?: string;
}

export function CollapsibleSection({ level, children, id }: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const Tag = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <div className="collapsible-section" data-level={level}>
      <Tag
        id={id}
        className="group flex items-center gap-1 cursor-pointer select-none"
        onClick={toggle}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            collapsed ? '' : 'rotate-90'
          }`}
        />
        {children}
      </Tag>
    </div>
  );
}
