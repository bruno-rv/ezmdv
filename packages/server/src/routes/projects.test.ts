import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createProjectRoutes } from './projects.js';
import { readState, writeState, type AppState } from '../state.js';

const tempDirs: string[] = [];
let app: express.Express;
let statePath: string;
let projectDir: string;
let projectId: string;

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezmdv-routes-'));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  const stateDir = makeTempDir();
  statePath = path.join(stateDir, 'state.json');
  projectDir = makeTempDir();

  // Create a test markdown file
  fs.writeFileSync(path.join(projectDir, 'readme.md'), '# Hello\n\nWorld');
  fs.mkdirSync(path.join(projectDir, 'docs'));
  fs.writeFileSync(path.join(projectDir, 'docs', 'guide.md'), '# Guide\n\nSee [[readme]].');

  projectId = 'test-project-1';
  const state: AppState = {
    theme: 'light',
    projects: [
      {
        id: projectId,
        name: 'Test Project',
        source: 'cli',
        path: projectDir,
        lastOpened: new Date().toISOString(),
      },
    ],
    openTabs: [],
    checkboxStates: {},
    dismissedCliPaths: [],
  };
  writeState(state, statePath);

  app = express();
  app.use(express.json());
  app.use('/api/projects', createProjectRoutes(statePath));
});

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('GET /api/projects', () => {
  it('returns list of projects', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test Project');
  });
});

describe('POST /api/projects', () => {
  it('creates a new CLI project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'New Project', path: projectDir, source: 'cli' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Project');
    expect(res.body.id).toBeDefined();
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ path: projectDir, source: 'cli' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects/:id/files', () => {
  it('lists markdown files in project directory', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/files`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'readme.md', type: 'file' }),
        expect.objectContaining({ name: 'docs', type: 'directory' }),
      ]),
    );
  });

  it('returns 404 for nonexistent project', async () => {
    const res = await request(app).get('/api/projects/nonexistent/files');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/projects/:id/files/*filePath', () => {
  it('reads a markdown file', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/files/readme.md`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('# Hello');
  });

  it('blocks path traversal (Express normalizes ../ in URL)', async () => {
    // Express 5 normalizes ../../ at the HTTP layer, resulting in 404 (not found)
    // rather than 403 — the traversal is blocked before reaching the handler
    const res = await request(app).get(
      `/api/projects/${projectId}/files/../../etc/passwd`,
    );
    expect([403, 404]).toContain(res.status);
  });

  it('returns 404 for nonexistent file', async () => {
    const res = await request(app).get(
      `/api/projects/${projectId}/files/nonexistent.md`,
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/projects/:id/files/*filePath', () => {
  it('writes content to a markdown file', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/files/readme.md`)
      .send({ content: '# Updated' });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);

    const content = fs.readFileSync(path.join(projectDir, 'readme.md'), 'utf-8');
    expect(content).toBe('# Updated');
  });

  it('blocks path traversal on write (Express normalizes ../ in URL)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/files/../../../tmp/evil.md`)
      .send({ content: 'evil' });
    expect([403, 404]).toContain(res.status);
  });

  it('rejects missing content', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/files/readme.md`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/projects/:id', () => {
  it('renames a project', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });
});

describe('GET /api/projects/:id/graph', () => {
  it('returns project graph with nodes and edges', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/graph`);
    expect(res.status).toBe(200);
    expect(res.body.nodes).toBeDefined();
    expect(res.body.edges).toBeDefined();
    expect(res.body.nodes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/projects/:id/search', () => {
  it('searches markdown content', async () => {
    const res = await request(app).get(
      `/api/projects/${projectId}/search?q=Hello`,
    );
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].filePath).toBe('readme.md');
  });

  it('returns empty results for no match', async () => {
    const res = await request(app).get(
      `/api/projects/${projectId}/search?q=nonexistent`,
    );
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });

  it('returns empty results for empty query', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/search?q=`);
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });
});

describe('GET /api/projects/search (global)', () => {
  it('searches across all projects', async () => {
    const res = await request(app).get('/api/projects/search?q=Hello');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].projectId).toBe(projectId);
    expect(res.body.results[0].projectName).toBe('Test Project');
    expect(res.body.results[0].filePath).toBe('readme.md');
  });

  it('returns empty results for no match', async () => {
    const res = await request(app).get('/api/projects/search?q=nonexistent');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });

  it('returns empty results for empty query', async () => {
    const res = await request(app).get('/api/projects/search?q=');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });
});

describe('GET /api/projects/:id/file-meta', () => {
  it('returns file metadata', async () => {
    const res = await request(app).get(
      `/api/projects/${projectId}/file-meta?path=readme.md`,
    );
    expect(res.status).toBe(200);
    expect(res.body.fileName).toBe('readme.md');
    expect(res.body.lineCount).toBeGreaterThanOrEqual(1);
    expect(res.body.sizeBytes).toBeGreaterThan(0);
  });

  it('rejects path traversal on file-meta', async () => {
    const res = await request(app).get(
      `/api/projects/${projectId}/file-meta?path=../../etc/passwd`,
    );
    expect(res.status).toBe(403);
  });

  it('rejects missing path parameter', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/file-meta`);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('removes a CLI project from state', async () => {
    const res = await request(app).delete(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const listRes = await request(app).get('/api/projects');
    expect(listRes.body).toHaveLength(0);
  });

  it('returns 404 for nonexistent project', async () => {
    const res = await request(app).delete('/api/projects/nonexistent');
    expect(res.status).toBe(404);
  });

  it('adds CLI project path to dismissedCliPaths on delete', async () => {
    const res = await request(app).delete(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);

    const state = readState(statePath);
    expect(state.dismissedCliPaths).toContain(projectDir);
  });
});
