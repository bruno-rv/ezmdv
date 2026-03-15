import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeBlock } from './CodeBlock';

// Mock clipboard API
const writeTextMock = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: {
    writeText: writeTextMock,
  },
});

describe('CodeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders code with language label', () => {
    render(<CodeBlock code="const x = 1;" language="javascript" />);
    expect(screen.getByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
  });

  it('shows "text" when no language is specified', () => {
    render(<CodeBlock code="hello" />);
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('has a copy button with aria label', () => {
    render(<CodeBlock code="code here" language="python" />);
    const btn = screen.getByLabelText('Copy code to clipboard');
    expect(btn).toBeInTheDocument();
  });

  it('copies code to clipboard when copy button is clicked', async () => {
    render(<CodeBlock code="const x = 42;" language="javascript" />);
    const btn = screen.getByLabelText('Copy code to clipboard');
    fireEvent.click(btn);

    expect(writeTextMock).toHaveBeenCalledWith('const x = 42;');
    await waitFor(() => {
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });
  });

  it('renders MermaidBlock for mermaid language', () => {
    render(<CodeBlock code="graph TD; A-->B;" language="mermaid" />);
    // Should show loading state from MermaidBlock lazy loading
    expect(screen.getByText('Loading diagram...')).toBeInTheDocument();
  });

  it('renders highlighted children when provided', () => {
    render(
      <CodeBlock
        code="x = 1"
        language="python"
        highlightedChildren={<span className="hljs-keyword">x</span>}
      />,
    );
    const keyword = document.querySelector('.hljs-keyword');
    expect(keyword).toBeInTheDocument();
  });
});
