import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchProjects, createProject, fetchFileContent, fetchState, updateState } from './api';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('fetchProjects', () => {
  it('should fetch and return projects', async () => {
    const projects = [
      { id: '1', name: 'Test', source: 'cli', path: '/tmp', lastOpened: '2024-01-01' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => projects,
    });

    const result = await fetchProjects();
    expect(result).toEqual(projects);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects'),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('should throw on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(fetchProjects()).rejects.toThrow('API error 500');
  });
});

describe('createProject', () => {
  it('should POST and return the new project', async () => {
    const newProject = {
      id: '2',
      name: 'New',
      source: 'upload' as const,
      path: '/tmp/new',
      lastOpened: '2024-01-02',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newProject,
    });

    const result = await createProject({
      name: 'New',
      path: '/tmp/new',
      source: 'upload',
    });
    expect(result).toEqual(newProject);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New', path: '/tmp/new', source: 'upload' }),
      }),
    );
  });
});

describe('fetchFileContent', () => {
  it('should fetch file content as text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Hello\n\nWorld',
    });

    const content = await fetchFileContent('proj1', 'docs/readme.md');
    expect(content).toBe('# Hello\n\nWorld');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/proj1/files/docs/readme.md'),
    );
  });
});

describe('fetchState', () => {
  it('should fetch app state', async () => {
    const state = {
      theme: 'dark',
      projects: [],
      openTabs: [],
      checkboxStates: {},
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => state,
    });

    const result = await fetchState();
    expect(result).toEqual(state);
  });
});

describe('updateState', () => {
  it('should PATCH state', async () => {
    const updated = {
      theme: 'dark',
      projects: [],
      openTabs: [],
      checkboxStates: {},
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updated,
    });

    const result = await updateState({ theme: 'dark' });
    expect(result).toEqual(updated);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/state'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ theme: 'dark' }),
      }),
    );
  });
});
