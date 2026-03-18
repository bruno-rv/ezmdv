import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableOfContents, type TocHeading } from './TableOfContents';

describe('TableOfContents', () => {
  it('shows empty state when no headings', () => {
    render(<TableOfContents headings={[]} activeId={null} onHeadingClick={vi.fn()} />);
    expect(screen.getByText('No headings found')).toBeInTheDocument();
  });

  it('renders headings', () => {
    const headings: TocHeading[] = [
      { id: 'intro', text: 'Introduction', level: 1 },
      { id: 'details', text: 'Details', level: 2 },
    ];
    render(<TableOfContents headings={headings} activeId={null} onHeadingClick={vi.fn()} />);
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('highlights the active heading', () => {
    const headings: TocHeading[] = [
      { id: 'intro', text: 'Introduction', level: 1 },
      { id: 'details', text: 'Details', level: 2 },
    ];
    render(<TableOfContents headings={headings} activeId="intro" onHeadingClick={vi.fn()} />);
    const introButton = screen.getByText('Introduction');
    expect(introButton.className).toContain('font-semibold');
  });

  it('calls onHeadingClick when a heading is clicked', () => {
    const onHeadingClick = vi.fn();
    const headings: TocHeading[] = [
      { id: 'intro', text: 'Introduction', level: 1 },
    ];
    render(<TableOfContents headings={headings} activeId={null} onHeadingClick={onHeadingClick} />);
    fireEvent.click(screen.getByText('Introduction'));
    expect(onHeadingClick).toHaveBeenCalledWith('intro');
  });

  it('indents sub-headings based on level', () => {
    const headings: TocHeading[] = [
      { id: 'h1', text: 'H1', level: 1 },
      { id: 'h2', text: 'H2', level: 2 },
      { id: 'h3', text: 'H3', level: 3 },
    ];
    render(<TableOfContents headings={headings} activeId={null} onHeadingClick={vi.fn()} />);
    const h1 = screen.getByText('H1');
    const h3 = screen.getByText('H3');
    const h1PaddingLeft = h1.style.paddingLeft;
    const h3PaddingLeft = h3.style.paddingLeft;
    expect(parseInt(h3PaddingLeft)).toBeGreaterThan(parseInt(h1PaddingLeft));
  });
});
