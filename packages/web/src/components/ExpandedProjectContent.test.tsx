import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExpandedProjectContent } from './ExpandedProjectContent';
import type { ProjectWithFiles } from '@/hooks/useProjects';

vi.mock('@/lib/api', () => ({
  searchProjectContent: vi.fn().mockResolvedValue({ results: [] }),
}));

const project: ProjectWithFiles = {
  id: 'p1',
  name: 'Test Project',
  path: '/test',
  source: 'cli',
  lastOpened: '',
  files: [{ type: 'file', name: 'note.md', path: 'note.md' }],
  filesLoading: false,
};

const noop = () => {};

describe('ExpandedProjectContent', () => {
  it('renders the search input', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
      />,
    );
    expect(screen.getByPlaceholderText('Search note text...')).toBeInTheDocument();
  });

  it('renders the fuzzy toggle button', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
      />,
    );
    expect(screen.getByTitle('Switch to fuzzy search')).toBeInTheDocument();
  });

  it('fuzzy toggle switches between Aa and ~ labels', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
      />,
    );
    const toggle = screen.getByTitle('Switch to fuzzy search');
    expect(toggle).toHaveTextContent('Aa');
    fireEvent.click(toggle);
    expect(screen.getByTitle('Switch to exact search')).toHaveTextContent('~');
  });

  it('renders the graph (Waypoints) button', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
      />,
    );
    expect(screen.getByTitle('Open graph')).toBeInTheDocument();
  });

  it('renders FilePlus button when onCreateFile is provided', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
        onCreateFile={noop}
      />,
    );
    expect(screen.getByLabelText('Create new file')).toBeInTheDocument();
  });

  it('renders FolderPlus button when onCreateFolder is provided', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
        onCreateFolder={noop}
      />,
    );
    expect(screen.getByLabelText('Create new folder')).toBeInTheDocument();
  });

  it('hides search and action toolbar when globalFilter is set', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
        onCreateFile={noop}
        globalFilter={new Set(['note.md'])}
      />,
    );
    expect(screen.queryByPlaceholderText('Search note text...')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Create new file')).not.toBeInTheDocument();
  });

  it('calls onOpenGraph with project id when graph button is clicked', () => {
    const onOpenGraph = vi.fn();
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={onOpenGraph}
      />,
    );
    fireEvent.click(screen.getByTitle('Open graph'));
    expect(onOpenGraph).toHaveBeenCalledWith('p1');
  });

  it('shows create-file input when FilePlus is clicked', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
        onCreateFile={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText('Create new file'));
    expect(screen.getByPlaceholderText('new-note.md')).toBeInTheDocument();
  });

  it('shows create-folder input when FolderPlus is clicked', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
        onCreateFolder={noop}
      />,
    );
    fireEvent.click(screen.getByLabelText('Create new folder'));
    expect(screen.getByPlaceholderText('new-folder')).toBeInTheDocument();
  });

  it('renders listed file from project.files', () => {
    render(
      <ExpandedProjectContent
        project={project}
        activeTab={null}
        onFileClick={noop}
        onOpenGraph={noop}
      />,
    );
    expect(screen.getByText('note.md')).toBeInTheDocument();
  });
});
