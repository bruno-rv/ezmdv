import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface FootnoteCardProps {
  id: string;
  content: ReactNode;
  children: ReactNode;
}

export function FootnoteCard({ id, content, children }: FootnoteCardProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: Math.max(8, rect.left - 100),
      });
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;
    function handleClick(e: MouseEvent) {
      if (
        cardRef.current &&
        !cardRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible]);

  return (
    <>
      <sup>
        <a
          ref={triggerRef as React.RefObject<HTMLAnchorElement>}
          href={`#fn-${id}`}
          className="text-primary hover:underline cursor-pointer"
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          aria-describedby={`footnote-card-${id}`}
        >
          {children}
        </a>
      </sup>
      {visible && (
        <div
          ref={cardRef}
          id={`footnote-card-${id}`}
          role="tooltip"
          className="fixed z-50 max-w-[300px] rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
          style={{ top: position.top, left: position.left }}
        >
          {content}
        </div>
      )}
    </>
  );
}
