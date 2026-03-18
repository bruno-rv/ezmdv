import { useMemo, useRef, useState, useCallback, useEffect, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { CollapsibleSection } from './CollapsibleSection';
import { FootnoteCard } from './FootnoteCard';
import {
  transformWikiLinksToMarkdown,
  WIKI_LINK_PREFIX,
  type InternalLinkKind,
} from '@/lib/markdownLinks';
import { getImageUrl } from '@/lib/api';
import type { TocHeading } from './TableOfContents';

interface MarkdownViewProps {
  content: string;
  onLinkClick: (target: string, kind: InternalLinkKind) => void;
  onCheckboxChange?: (index: number, checked: boolean) => void;
  onHeadingsExtracted?: (headings: TocHeading[]) => void;
  zoom?: number;
  projectId?: string;
}

function TableCopyWrapper({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLTableElement | null>(null);

  const handleCopy = useCallback(async () => {
    const table = tableRef.current;
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    const tsv = Array.from(rows)
      .map((row) =>
        Array.from(row.querySelectorAll('th, td'))
          .map((cell) => cell.textContent?.trim() ?? '')
          .join('\t'),
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore if clipboard unavailable
    }
  }, []);

  return (
    <div className="group relative my-4">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent bg-background/80 border border-border z-10"
        aria-label={copied ? 'Copied table to clipboard' : 'Copy table to clipboard'}
      >
        {copied ? (
          <>
            <Check className="size-3.5" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>
      <table ref={tableRef}>{children}</table>
    </div>
  );
}

export function MarkdownView({
  content,
  onLinkClick,
  onCheckboxChange,
  onHeadingsExtracted,
  zoom = 1,
  projectId,
}: MarkdownViewProps) {
  const remarkPlugins = useMemo(() => [remarkGfm], []);
  const rehypePlugins = useMemo(() => [rehypeHighlight], []);
  const renderedContent = useMemo(
    () => transformWikiLinksToMarkdown(content),
    [content],
  );

  // Use a ref to track checkbox index across the render cycle.
  // Reset on each render.
  const checkboxIndexRef = useRef(-1);
  checkboxIndexRef.current = -1;

  // Track whether we're inside a pre block to distinguish fenced code from inline code
  const insidePreRef = useRef(false);

  // Track footnote definitions extracted from the DOM
  const [footnoteMap, setFootnoteMap] = useState<Record<string, string>>({});

  const containerNodeRef = useRef<HTMLDivElement | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    containerNodeRef.current = node;
    if (!node) return;

    const footnotesSection = node.querySelector('[data-footnotes]') ?? node.querySelector('.footnotes');
    if (footnotesSection) {
      const map: Record<string, string> = {};
      const listItems = footnotesSection.querySelectorAll('li[id]');
      for (const li of listItems) {
        const id = li.getAttribute('id') ?? '';
        const match = id.match(/fn-(.+)$/);
        if (match) {
          const clone = li.cloneNode(true) as HTMLElement;
          const backRef = clone.querySelector('.data-footnote-backref') ?? clone.querySelector('a[href^="#user-content-fnref"]');
          if (backRef) backRef.remove();
          map[match[1]] = clone.textContent?.trim() ?? '';
        }
      }

      if (Object.keys(map).length > 0) {
        setFootnoteMap((prev) => {
          const prevKeys = Object.keys(prev).sort().join(',');
          const newKeys = Object.keys(map).sort().join(',');
          if (prevKeys === newKeys) return prev;
          return map;
        });
      }
    }

    if (onHeadingsExtracted) {
      const headingEls = node.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const headings: TocHeading[] = [];
      headingEls.forEach((el) => {
        const id = el.getAttribute('id');
        if (!id) return;
        const level = parseInt(el.tagName[1], 10);
        const text = el.textContent?.trim() ?? '';
        if (text) headings.push({ id, text, level });
      });
      onHeadingsExtracted(headings);
    }
  }, [onHeadingsExtracted]);

  const components = useMemo(() => {
    return {
      // pre: passthrough that sets a flag so code knows it's a fenced block
      pre: ({
        children,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'pre'> & { node?: unknown }) => {
        insidePreRef.current = true;
        const { className } = props;
        return <div className={className}>{children}</div>;
      },

      code: ({
        className,
        children,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'code'> & { node?: unknown }) => {
        // Detect fenced code block by className containing language-*
        const languageMatch = className?.match(/language-(\S+)/);

        if (languageMatch || insidePreRef.current) {
          // This is a fenced code block
          insidePreRef.current = false; // reset
          const language = languageMatch?.[1];
          const text = extractText(children);
          return (
            <CodeBlock
              code={text}
              language={language}
              highlightedChildren={children}
            />
          );
        }

        // Inline code
        return (
          <code
            className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      },

      // Links: intercept .md links for internal navigation, and add footnote hover behavior
      a: ({
        href,
        children,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'a'> & { node?: unknown }) => {
        // Check if this is a footnote reference link (href like #user-content-fn-<label>)
        const footnoteRefMatch = href?.match(/#user-content-fn-(.+)$/);
        if (footnoteRefMatch) {
          const fnId = footnoteRefMatch[1];
          const fnContent = footnoteMap[fnId];
          if (fnContent) {
            return (
              <FootnoteCard id={fnId} content={fnContent}>
                {children}
              </FootnoteCard>
            );
          }
        }

        if (href?.startsWith(WIKI_LINK_PREFIX)) {
          const [targetPath, heading] = href.slice(WIKI_LINK_PREFIX.length).split('#');
          const decodedTarget = decodeURIComponent(targetPath).replace(/\.md$/i, '');
          const target = heading
            ? `${decodedTarget}#${decodeURIComponent(heading)}`
            : decodedTarget;
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                onLinkClick(target, 'wiki');
              }}
              className="text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer"
              {...props}
            >
              {children}
            </a>
          );
        }

        if (href && isMarkdownLink(href)) {
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                onLinkClick(href, 'markdown');
              }}
              className="text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer"
              {...props}
            >
              {children}
            </a>
          );
        }

        // External link
        const isExternal =
          href?.startsWith('http://') || href?.startsWith('https://');
        return (
          <a
            href={href}
            className="text-primary underline underline-offset-2 hover:text-primary/80"
            {...(isExternal
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
            {...props}
          >
            {children}
          </a>
        );
      },

      // Checkboxes in task lists
      input: ({
        type,
        checked,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'input'> & { node?: unknown }) => {
        if (type === 'checkbox') {
          checkboxIndexRef.current++;
          const idx = checkboxIndexRef.current;
          return (
            <input
              type="checkbox"
              checked={checked ?? false}
              onChange={(e) => onCheckboxChange?.(idx, e.target.checked)}
              className="mr-2 cursor-pointer accent-primary"
              aria-label={`Task item ${idx + 1}`}
              {...props}
            />
          );
        }
        return <input type={type} checked={checked} {...props} />;
      },

      // Collapsible headings
      h1: createHeadingComponent(1),
      h2: createHeadingComponent(2),
      h3: createHeadingComponent(3),
      h4: createHeadingComponent(4),
      h5: createHeadingComponent(5),
      h6: createHeadingComponent(6),

      // Hide the default footnote section (we show footnotes inline via tooltips)
      section: ({
        children,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'section'> & { node?: unknown; 'data-footnotes'?: boolean }) => {
        // GFM renders footnote definitions in a <section data-footnotes>
        const dataFootnotes = (props as Record<string, unknown>)['data-footnotes'];
        if (dataFootnotes !== undefined) {
          // Render hidden so we can extract content via DOM ref, but hide it visually
          return (
            <section {...props} data-footnotes="" className="sr-only" aria-hidden="true">
              {children}
            </section>
          );
        }
        return <section {...props}>{children}</section>;
      },

      table: ({
        children,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'table'> & { node?: unknown }) => {
        return <TableCopyWrapper {...props}>{children}</TableCopyWrapper>;
      },

      img: ({
        src,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'img'> & { node?: unknown }) => {
        let resolvedSrc = src;
        if (projectId && src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
          if (src.startsWith('images/')) {
            const imagePath = src.slice('images/'.length);
            resolvedSrc = getImageUrl(projectId, imagePath);
          }
        }
        return <img src={resolvedSrc} {...props} />;
      },
    };
  }, [onLinkClick, onCheckboxChange, footnoteMap, projectId]);

  return (
    <div
      className="markdown-body prose prose-sm dark:prose-invert max-w-none"
      style={zoom !== 1 ? { fontSize: `${zoom * 100}%` } : undefined}
      ref={containerRef}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}

function createHeadingComponent(level: number) {
  return function HeadingComponent({
    children,
    id,
    node: _node,
    ...props
  }: ComponentPropsWithoutRef<'h1'> & { node?: unknown }) {
    const headingId = id || slugify(extractText(children));

    return (
      <CollapsibleSection level={level} id={headingId} {...props}>
        {children}
      </CollapsibleSection>
    );
  };
}

function isMarkdownLink(href: string): boolean {
  // Match relative .md links (not starting with http/https)
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return false;
  }
  return /\.md(#.*)?$/i.test(href);
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractText(
      (node as { props: { children?: ReactNode } }).props.children,
    );
  }
  return '';
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}
