import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { FolderPlus, Trash2 } from 'lucide-react';

interface MenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface FileTreeContextMenuProps {
  children: ReactNode;
  items: MenuItem[];
}

export function FileTreeContextMenu({ children, items }: FileTreeContextMenuProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    const handler = () => close();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [pos, close]);

  useEffect(() => {
    if (!pos) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pos, close]);

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
      {pos && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md border border-border bg-popover py-1 text-sm shadow-md"
          style={{ left: pos.x, top: pos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                item.danger
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-popover-foreground hover:bg-muted/50'
              }`}
              onClick={() => {
                close();
                item.onClick();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { FolderPlus, Trash2 };
