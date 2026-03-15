import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  level: number;
  children: ReactNode;
  id?: string;
}

export function CollapsibleSection({ level, children, id }: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // DOM manipulation to hide/show siblings until next heading of same or higher level
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let sibling = section.nextElementSibling;
    while (sibling) {
      // Stop at next heading of same or higher level
      if (sibling.classList.contains('collapsible-section')) {
        const sibLevel = Number(sibling.getAttribute('data-level'));
        if (sibLevel <= level) break;
      }
      (sibling as HTMLElement).style.display = collapsed ? 'none' : '';
      sibling = sibling.nextElementSibling;
    }
  }, [collapsed, level]);

  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  return (
    <div
      className="collapsible-section"
      data-level={level}
      data-collapsed={collapsed ? 'true' : 'false'}
      ref={sectionRef}
    >
      <Tag
        id={id}
        className="group flex items-center gap-1 cursor-pointer select-none"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          toggle();
        }}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
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
