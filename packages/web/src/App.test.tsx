import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the API module to avoid actual network calls
vi.mock('@/lib/api', () => ({
  fetchProjects: vi.fn().mockResolvedValue([]),
  fetchProjectFiles: vi.fn().mockResolvedValue([]),
  fetchFileContent: vi.fn().mockResolvedValue(''),
  createProject: vi.fn().mockResolvedValue({ id: '1', name: 'test', source: 'upload', path: '/tmp', lastOpened: '' }),
  uploadFiles: vi.fn().mockResolvedValue(undefined),
  fetchState: vi.fn().mockResolvedValue({ theme: 'light', projects: [], openTabs: [], checkboxStates: {} }),
  updateState: vi.fn().mockResolvedValue({ theme: 'light', projects: [], openTabs: [], checkboxStates: {} }),
}));

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    // Should show the app title in the sidebar
    // "ezmdv" appears in both the sidebar and mobile header
    const titles = screen.getAllByText('ezmdv');
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it('should show placeholder text when no file is selected', () => {
    render(<App />);
    expect(screen.getByText('Select a file to view')).toBeInTheDocument();
  });

  it('should render the upload button', () => {
    render(<App />);
    expect(screen.getByText('Upload MD')).toBeInTheDocument();
  });
});
