import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette, useCommandPaletteActions, type CommandPaletteAction } from './CommandPalette';
import { renderHook } from '@testing-library/react';
import { Zap } from 'lucide-react';
import type { Tab } from '@/lib/api';
import type { ProjectWithFiles } from '@/hooks/useProjects';

function makeProject(id: string, name: string, files?: Array<{ name: string; path: string }>): ProjectWithFiles {
  return {
    id,
    name,
    source: 'upload',
    path: `/test/${name}`,
    lastOpened: new Date().toISOString(),
    files: files?.map((f) => ({ name: f.name, path: f.path, type: 'file' as const })),
    filesLoading: false,
  };
}

const mockActions: CommandPaletteAction[] = [
  { id: 'test-action', label: 'Test Action', icon: Zap, onExecute: vi.fn() },
];

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette
        open={false}
        onClose={vi.fn()}
        projects={[]}
        tabs={[]}
        activeTab={null}
        theme="light"
        actions={mockActions}
        onFileSelect={vi.fn()}
        onTabSelect={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when open', () => {
    render(
      <CommandPalette
        open={true}
        onClose={vi.fn()}
        projects={[]}
        tabs={[]}
        activeTab={null}
        theme="light"
        actions={mockActions}
        onFileSelect={vi.fn()}
        onTabSelect={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText(/Search files/)).toBeInTheDocument();
  });

  it('shows open tabs in results', () => {
    const tabs: Tab[] = [{ projectId: 'p1', filePath: 'notes.md' }];
    const projects = [makeProject('p1', 'MyProject')];

    render(
      <CommandPalette
        open={true}
        onClose={vi.fn()}
        projects={projects}
        tabs={tabs}
        activeTab={null}
        theme="light"
        actions={[]}
        onFileSelect={vi.fn()}
        onTabSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('notes.md')).toBeInTheDocument();
    expect(screen.getByText('TAB')).toBeInTheDocument();
  });

  it('shows files from projects in results', () => {
    const projects = [
      makeProject('p1', 'Docs', [
        { name: 'readme.md', path: 'readme.md' },
        { name: 'guide.md', path: 'guide.md' },
      ]),
    ];

    render(
      <CommandPalette
        open={true}
        onClose={vi.fn()}
        projects={projects}
        tabs={[]}
        activeTab={null}
        theme="light"
        actions={[]}
        onFileSelect={vi.fn()}
        onTabSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('readme.md')).toBeInTheDocument();
    expect(screen.getByText('guide.md')).toBeInTheDocument();
  });

  it('filters results by query', () => {
    const projects = [
      makeProject('p1', 'Docs', [
        { name: 'readme.md', path: 'readme.md' },
        { name: 'guide.md', path: 'guide.md' },
      ]),
    ];

    render(
      <CommandPalette
        open={true}
        onClose={vi.fn()}
        projects={projects}
        tabs={[]}
        activeTab={null}
        theme="light"
        actions={[]}
        onFileSelect={vi.fn()}
        onTabSelect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Search files/), {
      target: { value: 'guide' },
    });

    expect(screen.getByText('guide.md')).toBeInTheDocument();
    expect(screen.queryByText('readme.md')).not.toBeInTheDocument();
  });

  it('shows actions when query starts with >', () => {
    render(
      <CommandPalette
        open={true}
        onClose={vi.fn()}
        projects={[]}
        tabs={[]}
        activeTab={null}
        theme="light"
        actions={mockActions}
        onFileSelect={vi.fn()}
        onTabSelect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Search files/), {
      target: { value: '>' },
    });

    expect(screen.getByText('Test Action')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        projects={[]}
        tabs={[]}
        activeTab={null}
        theme="light"
        actions={[]}
        onFileSelect={vi.fn()}
        onTabSelect={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText(/Search files/), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onFileSelect when a file result is clicked', () => {
    const onFileSelect = vi.fn();
    const onClose = vi.fn();
    const projects = [
      makeProject('p1', 'Docs', [{ name: 'test.md', path: 'test.md' }]),
    ];

    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        projects={projects}
        tabs={[]}
        activeTab={null}
        theme="light"
        actions={[]}
        onFileSelect={onFileSelect}
        onTabSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('test.md'));
    expect(onFileSelect).toHaveBeenCalledWith('p1', 'test.md');
  });
});

describe('useCommandPaletteActions', () => {
  it('returns actions array with theme toggle', () => {
    const { result } = renderHook(() =>
      useCommandPaletteActions({
        theme: 'dark',
        toggleTheme: vi.fn(),
        editMode: false,
        splitView: false,
        handleEnterEdit: vi.fn(),
        handleExitEdit: vi.fn(),
        handleSplitView: vi.fn(),
        onShowShortcuts: vi.fn(),
      }),
    );

    expect(result.current.length).toBeGreaterThanOrEqual(3);
    expect(result.current.find((a) => a.id === 'toggle-theme')).toBeDefined();
    expect(result.current.find((a) => a.id === 'toggle-theme')!.label).toContain('light');
  });

  it('shows "Enter edit mode" when not editing', () => {
    const { result } = renderHook(() =>
      useCommandPaletteActions({
        theme: 'light',
        toggleTheme: vi.fn(),
        editMode: false,
        splitView: false,
        handleEnterEdit: vi.fn(),
        handleExitEdit: vi.fn(),
        handleSplitView: vi.fn(),
        onShowShortcuts: vi.fn(),
      }),
    );

    const editAction = result.current.find((a) => a.id === 'toggle-edit');
    expect(editAction?.label).toContain('Enter');
  });

  it('shows "Exit edit mode" when editing', () => {
    const { result } = renderHook(() =>
      useCommandPaletteActions({
        theme: 'light',
        toggleTheme: vi.fn(),
        editMode: true,
        splitView: false,
        handleEnterEdit: vi.fn(),
        handleExitEdit: vi.fn(),
        handleSplitView: vi.fn(),
        onShowShortcuts: vi.fn(),
      }),
    );

    const editAction = result.current.find((a) => a.id === 'toggle-edit');
    expect(editAction?.label).toContain('Exit');
  });
});
