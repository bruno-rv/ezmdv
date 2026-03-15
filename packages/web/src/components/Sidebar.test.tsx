import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import type { ProjectWithFiles } from '@/hooks/useProjects';
import type { Tab } from '@/lib/api';

const mockProjects: ProjectWithFiles[] = [
  {
    id: 'proj1',
    name: 'My Project',
    source: 'cli',
    path: '/tmp/proj1',
    lastOpened: '2024-01-01',
    files: [
      { name: 'README.md', path: 'README.md', type: 'file' },
      {
        name: 'docs',
        path: 'docs',
        type: 'directory',
        children: [
          { name: 'guide.md', path: 'docs/guide.md', type: 'file' },
        ],
      },
    ],
    filesLoading: false,
  },
];

const defaultProps = {
  projects: mockProjects,
  activeTab: null as Tab | null,
  theme: 'light' as const,
  onThemeToggle: vi.fn(),
  onFileClick: vi.fn(),
  onExpandProject: vi.fn(),
  onUploadFiles: vi.fn(),
  isOpen: true,
  onClose: vi.fn(),
};

describe('Sidebar', () => {
  it('should render the title', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('ezmdv')).toBeInTheDocument();
  });

  it('should render project names', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('should expand a project and show files', () => {
    render(<Sidebar {...defaultProps} />);

    // Click on the project to expand
    fireEvent.click(screen.getByText('My Project'));

    expect(defaultProps.onExpandProject).toHaveBeenCalledWith('proj1');
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('docs')).toBeInTheDocument();
  });

  it('should call onFileClick when clicking a file', () => {
    render(<Sidebar {...defaultProps} />);

    // Expand project first
    fireEvent.click(screen.getByText('My Project'));

    // Click on a file
    fireEvent.click(screen.getByText('README.md'));
    expect(defaultProps.onFileClick).toHaveBeenCalledWith('proj1', 'README.md');
  });

  it('should expand directories to show nested files', () => {
    render(<Sidebar {...defaultProps} />);

    // Expand project
    fireEvent.click(screen.getByText('My Project'));

    // Expand docs directory
    fireEvent.click(screen.getByText('docs'));

    expect(screen.getByText('guide.md')).toBeInTheDocument();
  });

  it('should show upload button', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Upload MD')).toBeInTheDocument();
  });

  it('should show upload menu on button click', () => {
    render(<Sidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('Upload MD'));

    expect(screen.getByText('Upload Files')).toBeInTheDocument();
    expect(screen.getByText('Upload Folder')).toBeInTheDocument();
  });

  it('should show empty state when no projects', () => {
    render(<Sidebar {...defaultProps} projects={[]} />);
    expect(
      screen.getByText(/No projects yet/),
    ).toBeInTheDocument();
  });
});
