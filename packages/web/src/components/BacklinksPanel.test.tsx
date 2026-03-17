import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacklinksPanel, type Backlink } from './BacklinksPanel';

describe('BacklinksPanel', () => {
  it('shows loading state', () => {
    render(<BacklinksPanel backlinks={[]} loading={true} onFileClick={vi.fn()} />);
    expect(screen.getByText(/Loading backlinks/)).toBeInTheDocument();
  });

  it('shows empty state when no backlinks', () => {
    render(<BacklinksPanel backlinks={[]} loading={false} onFileClick={vi.fn()} />);
    expect(screen.getByText(/No backlinks found/)).toBeInTheDocument();
  });

  it('renders backlink entries', () => {
    const backlinks: Backlink[] = [
      { sourceFile: 'notes/intro.md', linkText: 'test', context: 'See [[test]] for details' },
      { sourceFile: 'index.md', linkText: 'test', context: 'Check out [[test]]' },
    ];
    render(<BacklinksPanel backlinks={backlinks} loading={false} onFileClick={vi.fn()} />);
    expect(screen.getByText('intro.md')).toBeInTheDocument();
    expect(screen.getByText('index.md')).toBeInTheDocument();
    expect(screen.getByText('See [[test]] for details')).toBeInTheDocument();
  });

  it('calls onFileClick when a backlink is clicked', () => {
    const onFileClick = vi.fn();
    const backlinks: Backlink[] = [
      { sourceFile: 'notes/intro.md', linkText: 'test', context: 'See [[test]]' },
    ];
    render(<BacklinksPanel backlinks={backlinks} loading={false} onFileClick={onFileClick} />);
    fireEvent.click(screen.getByText('intro.md'));
    expect(onFileClick).toHaveBeenCalledWith('notes/intro.md');
  });
});
