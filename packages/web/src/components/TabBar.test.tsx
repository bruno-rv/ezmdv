import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from './TabBar';
import type { Tab } from '@/lib/api';

const tabs: Tab[] = [
  { projectId: 'proj1', filePath: 'README.md' },
  { projectId: 'proj1', filePath: 'docs/guide.md' },
  { projectId: 'proj2', filePath: 'notes.md' },
];

describe('TabBar', () => {
  it('should render all tabs with filenames', () => {
    render(
      <TabBar
        tabs={tabs}
        activeTab={tabs[0]}
        onTabClick={vi.fn()}
        onTabClose={vi.fn()}
      />,
    );

    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('guide.md')).toBeInTheDocument();
    expect(screen.getByText('notes.md')).toBeInTheDocument();
  });

  it('should mark the active tab', () => {
    render(
      <TabBar
        tabs={tabs}
        activeTab={tabs[0]}
        onTabClick={vi.fn()}
        onTabClose={vi.fn()}
      />,
    );

    const activeTabEl = screen.getByText('README.md').closest('[role="tab"]');
    expect(activeTabEl).toHaveAttribute('aria-selected', 'true');

    const inactiveTabEl = screen.getByText('guide.md').closest('[role="tab"]');
    expect(inactiveTabEl).toHaveAttribute('aria-selected', 'false');
  });

  it('should call onTabClick when tab is clicked', () => {
    const onTabClick = vi.fn();
    render(
      <TabBar
        tabs={tabs}
        activeTab={tabs[0]}
        onTabClick={onTabClick}
        onTabClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('guide.md'));
    expect(onTabClick).toHaveBeenCalledWith('proj1', 'docs/guide.md');
  });

  it('should call onTabClose when close button is clicked', () => {
    const onTabClose = vi.fn();
    render(
      <TabBar
        tabs={tabs}
        activeTab={tabs[0]}
        onTabClick={vi.fn()}
        onTabClose={onTabClose}
      />,
    );

    const closeButtons = screen.getAllByLabelText(/Close/);
    fireEvent.click(closeButtons[0]);
    expect(onTabClose).toHaveBeenCalledWith('proj1', 'README.md');
  });

  it('should render nothing when no tabs', () => {
    const { container } = render(
      <TabBar
        tabs={[]}
        activeTab={null}
        onTabClick={vi.fn()}
        onTabClose={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
