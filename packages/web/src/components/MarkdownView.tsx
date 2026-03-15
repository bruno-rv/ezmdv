import { useMemo, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { CodeBlock } from './CodeBlock';
import { CollapsibleSection } from './CollapsibleSection';

interface MarkdownViewProps {
  content: string;
  onLinkClick: (filePath: string) => void;
  onCheckboxChange?: (index: number, checked: boolean) => void;
}

export function MarkdownView({
  content,
  onLinkClick,
  onCheckboxChange,
}: MarkdownViewProps) {
  const remarkPlugins = useMemo(() => [remarkGfm], []);
  const rehypePlugins = useMemo(() => [rehypeHighlight], []);

  // Use a ref to track checkbox index across the render cycle.
  // Reset on each render.
  const checkboxIndexRef = useRef(-1);
  checkboxIndexRef.current = -1;

  // Track whether we're inside a pre block to distinguish fenced code from inline code
  const insidePreRef = useRef(false);

  const components = useMemo(() => {
    return {
      // pre: passthrough that sets a flag so code knows it's a fenced block
      pre: ({
        children,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'pre'> & { node?: unknown }) => {
        insidePreRef.current = true;
        const result = <div {...props}>{children}</div>;
        // We can't unset synchronously here because children render during this call.
        // Instead, reset it after a microtask. But a simpler approach:
        // just always set it before returning — the code component checks it inline.
        return result;
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

      // Links: intercept .md links for internal navigation
      a: ({
        href,
        children,
        node: _node,
        ...props
      }: ComponentPropsWithoutRef<'a'> & { node?: unknown }) => {
        if (href && isMarkdownLink(href)) {
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                onLinkClick(href);
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
    };
  }, [onLinkClick, onCheckboxChange]);

  return (
    <div className="markdown-body prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
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
    return (
      <CollapsibleSection level={level} id={id} {...props}>
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
