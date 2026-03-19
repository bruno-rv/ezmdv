import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExpandedProjectContent } from './ExpandedProjectContent';
import type { ProjectWithFiles } from '@/hooks/useProjects';

vi.mock('@/lib/api', () => ({}));

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
  it('hides action toolbar when globalFilter is set', () => {
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
    expect(screen.queryByLabelText('Create new file')).not.toBeInTheDocument();
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
