import { useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: TocHeading[];
  activeId: string | null;
  onHeadingClick: (id: string) => void;
}

export function TableOfContents({ headings, activeId, onHeadingClick }: TableOfContentsProps) {
  const handleClick = useCallback(
    (id: string) => {
      onHeadingClick(id);
    },
    [onHeadingClick],
  );

  if (headings.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">No headings found</div>
    );
  }

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav className="flex flex-col overflow-y-auto py-2" aria-label="Table of contents">
      {headings.map((heading) => (
        <button
          key={heading.id}
          className={cn(
            'truncate text-left text-xs py-1 px-3 hover:bg-muted/50 transition-colors',
            activeId === heading.id
              ? 'font-semibold text-primary'
              : 'text-muted-foreground',
          )}
          style={{ paddingLeft: `${(heading.level - minLevel) * 12 + 12}px` }}
          onClick={() => handleClick(heading.id)}
          title={heading.text}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );
}
