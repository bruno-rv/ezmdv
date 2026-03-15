import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownView } from './MarkdownView';

// Mock rehype-highlight to avoid ESM/highlight.js issues in test
vi.mock('rehype-highlight', () => ({
  default: () => () => {},
}));

describe('MarkdownView', () => {
  const defaultProps = {
    content: '',
    onLinkClick: vi.fn(),
    onCheckboxChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders basic markdown headings and paragraphs', () => {
    render(
      <MarkdownView
        {...defaultProps}
        content={'# Hello World\n\nThis is a paragraph.'}
      />,
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
  });

  it('renders GFM tables', () => {
    const tableMarkdown = `
| Name | Age |
|------|-----|
| Alice | 30 |
| Bob | 25 |
`;
    render(<MarkdownView {...defaultProps} content={tableMarkdown} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();

    // Verify table elements exist
    const table = document.querySelector('table');
    expect(table).toBeInTheDocument();
  });

  it('renders task lists with checkboxes', () => {
    const taskListMd = `- [x] Done task\n- [ ] Pending task`;
    render(<MarkdownView {...defaultProps} content={taskListMd} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('calls onCheckboxChange when a checkbox is clicked', () => {
    const onCheckboxChange = vi.fn();
    const taskListMd = `- [ ] First\n- [ ] Second`;
    render(
      <MarkdownView
        {...defaultProps}
        content={taskListMd}
        onCheckboxChange={onCheckboxChange}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    expect(onCheckboxChange).toHaveBeenCalledWith(1, true);
  });

  it('calls onLinkClick for internal .md links', () => {
    const onLinkClick = vi.fn();
    render(
      <MarkdownView
        {...defaultProps}
        content={'[Link](./other.md)'}
        onLinkClick={onLinkClick}
      />,
    );

    const link = screen.getByText('Link');
    fireEvent.click(link);
    expect(onLinkClick).toHaveBeenCalledWith('./other.md');
  });

  it('renders external links with target="_blank"', () => {
    render(
      <MarkdownView
        {...defaultProps}
        content={'[Google](https://google.com)'}
      />,
    );

    const link = screen.getByText('Google');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not call onLinkClick for external links', () => {
    const onLinkClick = vi.fn();
    render(
      <MarkdownView
        {...defaultProps}
        content={'[Google](https://google.com)'}
        onLinkClick={onLinkClick}
      />,
    );

    const link = screen.getByText('Google');
    fireEvent.click(link);
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  it('renders code blocks with CodeBlock wrapper', () => {
    const codeMd = '```javascript\nconsole.log("hi");\n```';
    render(<MarkdownView {...defaultProps} content={codeMd} />);

    // Should have a copy button
    expect(screen.getByLabelText('Copy code to clipboard')).toBeInTheDocument();
    // Should show language label
    expect(screen.getByText('javascript')).toBeInTheDocument();
  });

  it('renders inline code', () => {
    render(
      <MarkdownView {...defaultProps} content={'Use `const x = 1` here.'} />,
    );
    const code = screen.getByText('const x = 1');
    expect(code.tagName).toBe('CODE');
  });

  it('renders blockquotes', () => {
    render(
      <MarkdownView {...defaultProps} content={'> This is a quote'} />,
    );
    expect(screen.getByText('This is a quote')).toBeInTheDocument();
    const blockquote = document.querySelector('blockquote');
    expect(blockquote).toBeInTheDocument();
  });

  it('renders strikethrough text', () => {
    render(
      <MarkdownView {...defaultProps} content={'~~deleted~~'} />,
    );
    const del = document.querySelector('del');
    expect(del).toBeInTheDocument();
    expect(del?.textContent).toBe('deleted');
  });
});
