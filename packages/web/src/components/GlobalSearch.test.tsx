import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalSearch } from './GlobalSearch';

vi.mock('@/lib/api', () => ({
  searchAllProjects: vi.fn().mockResolvedValue({ results: [] }),
}));

describe('GlobalSearch', () => {
  it('renders the search input', () => {
    render(<GlobalSearch onFilterChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search all projects...')).toBeInTheDocument();
  });

  it('renders the fuzzy toggle button', () => {
    render(<GlobalSearch onFilterChange={vi.fn()} />);
    expect(screen.getByTitle('Switch to fuzzy search')).toBeInTheDocument();
  });

  it('fuzzy toggle switches labels between Aa Exact and ~ Fuzzy', () => {
    render(<GlobalSearch onFilterChange={vi.fn()} />);
    const toggle = screen.getByTitle('Switch to fuzzy search');
    expect(toggle).toHaveTextContent('Aa Exact');
    fireEvent.click(toggle);
    expect(screen.getByTitle('Switch to exact search')).toHaveTextContent('~ Fuzzy');
  });

  it('does not show the clear button when input is empty', () => {
    render(<GlobalSearch onFilterChange={vi.fn()} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('shows the clear button after typing a query', () => {
    render(<GlobalSearch onFilterChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search all projects...'), {
      target: { value: 'hello' },
    });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clear button resets the input', () => {
    const onFilterChange = vi.fn();
    render(<GlobalSearch onFilterChange={onFilterChange} />);
    const input = screen.getByPlaceholderText('Search all projects...');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input).toHaveValue('');
  });

  it('calls onFilterChange(null) when cleared', () => {
    const onFilterChange = vi.fn();
    render(<GlobalSearch onFilterChange={onFilterChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search all projects...'), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onFilterChange).toHaveBeenLastCalledWith(null);
  });
});
