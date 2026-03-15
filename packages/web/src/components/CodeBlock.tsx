import { useState, useCallback, lazy, Suspense } from 'react';
import { Copy, Check } from 'lucide-react';

const MermaidBlock = lazy(() => import('./MermaidBlock'));

interface CodeBlockProps {
  code: string;
  language?: string;
  highlightedChildren?: React.ReactNode;
}

export function CodeBlock({ code, language, highlightedChildren }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore if clipboard is unavailable
    }
  }, [code]);

  if (language === 'mermaid') {
    return (
      <Suspense
        fallback={
          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            Loading diagram...
          </div>
        }
      >
        <MermaidBlock code={code} />
      </Suspense>
    );
  }

  return (
    <div className="group relative rounded-lg border border-border bg-muted/50 text-sm my-4">
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
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
      </div>
      {/* Code content */}
      <div className="overflow-x-auto p-4">
        {highlightedChildren ? (
          <pre className="!m-0 !p-0 !bg-transparent">
            <code className={language ? `hljs language-${language}` : 'hljs'}>
              {highlightedChildren}
            </code>
          </pre>
        ) : (
          <pre className="!m-0 !p-0 !bg-transparent">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
