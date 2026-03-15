import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';
import { createServer } from './index.js';
import { writeState, type AppState } from './state.js';

let tmpDir: string;
let statePath: string;
let projectDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezmdv-routes-test-'));
  statePath = path.join(tmpDir, 'state.json');
  projectDir = path.join(tmpDir, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('API Routes', () => {
  it('GET /api/projects returns project list', async () => {
    const state: AppState = {
      theme: 'light',
      projects: [
        {
          id: 'p1',
          name: 'Test Project',
          source: 'cli',
          path: projectDir,
          lastOpened: '2024-01-01T00:00:00.000Z',
        },
      ],
      openTabs: [],
      checkboxStates: {},
    };
    writeState(state, statePath);

    const { app, watcher } = createServer({ statePath });
    const res = await request(app).get('/api/projects');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test Project');
    await watcher.close();
  });

  it('POST /api/projects creates a project', async () => {
    const { app, watcher } = createServer({ statePath });

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'New Project', path: projectDir, source: 'cli' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Project');
    expect(res.body.id).toBeDefined();
    expect(res.body.source).toBe('cli');

    // Verify it's persisted
    const listRes = await request(app).get('/api/projects');
    expect(listRes.body).toHaveLength(1);
    await watcher.close();
  });

  it('POST /api/projects returns 400 when fields are missing', async () => {
    const { app, watcher } = createServer({ statePath });

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Missing Fields' });

    expect(res.status).toBe(400);
    await watcher.close();
  });

  it('POST /api/projects auto-generates path for upload source', async () => {
    const { app, watcher } = createServer({ statePath });

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'My Upload', path: '', source: 'upload' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Upload');
    expect(res.body.source).toBe('upload');
    // Path should be under ~/.ezmdv/uploads/
    expect(res.body.path).toContain('.ezmdv');
    expect(res.body.path).toContain('uploads');
    expect(res.body.path).toContain('My Upload');

    // Verify the directory was created
    expect(fs.existsSync(res.body.path)).toBe(true);

    // Clean up
    fs.rmSync(res.body.path, { recursive: true, force: true });
    await watcher.close();
  });

  it('POST /api/projects returns 400 for cli source without path', async () => {
    const { app, watcher } = createServer({ statePath });

    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'CLI Project', source: 'cli' });

    expect(res.status).toBe(400);
    await watcher.close();
  });

  it('GET /api/projects/:id/files lists markdown files', async () => {
    // Create some files in the project dir
    fs.writeFileSync(path.join(projectDir, 'README.md'), '# Hello');
    fs.writeFileSync(path.join(projectDir, 'notes.md'), '# Notes');
    fs.writeFileSync(path.join(projectDir, 'data.txt'), 'not markdown');
    fs.mkdirSync(path.join(projectDir, 'docs'));
    fs.writeFileSync(path.join(projectDir, 'docs', 'guide.md'), '# Guide');

    const state: AppState = {
      theme: 'light',
      projects: [
        {
          id: 'p1',
          name: 'Test',
          source: 'cli',
          path: projectDir,
          lastOpened: '2024-01-01T00:00:00.000Z',
        },
      ],
      openTabs: [],
      checkboxStates: {},
    };
    writeState(state, statePath);

    const { app, watcher } = createServer({ statePath });
    const res = await request(app).get('/api/projects/p1/files');

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);

    // Should have docs dir and two .md files at root (no .txt)
    const names = res.body.map((e: { name: string }) => e.name);
    expect(names).toContain('docs');
    expect(names).toContain('README.md');
    expect(names).toContain('notes.md');
    expect(names).not.toContain('data.txt');

    // docs dir should contain guide.md
    const docsDir = res.body.find(
      (e: { name: string }) => e.name === 'docs',
    );
    expect(docsDir.children).toHaveLength(1);
    expect(docsDir.children[0].name).toBe('guide.md');
    await watcher.close();
  });

  it('GET /api/projects/:id/files returns 404 for unknown project', async () => {
    const { app, watcher } = createServer({ statePath });

    const res = await request(app).get('/api/projects/unknown/files');
    expect(res.status).toBe(404);
    await watcher.close();
  });

  it('GET /api/projects/:id/files/* returns file content', async () => {
    fs.writeFileSync(path.join(projectDir, 'test.md'), '# Test Content');

    const state: AppState = {
      theme: 'light',
      projects: [
        {
          id: 'p1',
          name: 'Test',
          source: 'cli',
          path: projectDir,
          lastOpened: '2024-01-01T00:00:00.000Z',
        },
      ],
      openTabs: [],
      checkboxStates: {},
    };
    writeState(state, statePath);

    const { app, watcher } = createServer({ statePath });
    const res = await request(app).get('/api/projects/p1/files/test.md');

    expect(res.status).toBe(200);
    expect(res.text).toBe('# Test Content');
    await watcher.close();
  });

  it('GET /api/projects/:id/files/* returns 404 for missing file', async () => {
    const state: AppState = {
      theme: 'light',
      projects: [
        {
          id: 'p1',
          name: 'Test',
          source: 'cli',
          path: projectDir,
          lastOpened: '2024-01-01T00:00:00.000Z',
        },
      ],
      openTabs: [],
      checkboxStates: {},
    };
    writeState(state, statePath);

    const { app, watcher } = createServer({ statePath });
    const res = await request(app).get('/api/projects/p1/files/nonexistent.md');

    expect(res.status).toBe(404);
    await watcher.close();
  });

  it('GET /api/state returns full state', async () => {
    const state: AppState = {
      theme: 'dark',
      projects: [],
      openTabs: [],
      checkboxStates: { 'f.md': { 'cb-0': true } },
    };
    writeState(state, statePath);

    const { app, watcher } = createServer({ statePath });
    const res = await request(app).get('/api/state');

    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('dark');
    expect(res.body.checkboxStates['f.md']['cb-0']).toBe(true);
    await watcher.close();
  });

  it('PATCH /api/state updates state', async () => {
    writeState(
      {
        theme: 'light',
        projects: [],
        openTabs: [],
        checkboxStates: {},
      },
      statePath,
    );

    const { app, watcher } = createServer({ statePath });
    const res = await request(app)
      .patch('/api/state')
      .send({ theme: 'dark' });

    expect(res.status).toBe(200);
    expect(res.body.theme).toBe('dark');

    // Verify persisted
    const getRes = await request(app).get('/api/state');
    expect(getRes.body.theme).toBe('dark');
    await watcher.close();
  });

  it('POST /api/projects/:id/upload handles file upload', async () => {
    const uploadDir = path.join(tmpDir, 'uploads', 'test-project');
    fs.mkdirSync(uploadDir, { recursive: true });

    const state: AppState = {
      theme: 'light',
      projects: [
        {
          id: 'p1',
          name: 'Test',
          source: 'upload',
          path: uploadDir,
          lastOpened: '2024-01-01T00:00:00.000Z',
        },
      ],
      openTabs: [],
      checkboxStates: {},
    };
    writeState(state, statePath);

    // Create a temp file to upload
    const tmpFile = path.join(tmpDir, 'upload-test.md');
    fs.writeFileSync(tmpFile, '# Uploaded');

    const { app, watcher } = createServer({ statePath });
    const res = await request(app)
      .post('/api/projects/p1/upload')
      .attach('files', tmpFile)
      .field('relativePaths', JSON.stringify(['upload-test.md']));

    expect(res.status).toBe(200);
    expect(res.body.uploaded).toContain('upload-test.md');

    // Verify file was moved to upload dir
    expect(
      fs.existsSync(path.join(uploadDir, 'upload-test.md')),
    ).toBe(true);
    await watcher.close();
  });

  it('server starts and responds to requests (smoke test)', async () => {
    const { app, server, watcher } = createServer({ statePath });

    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);

    server.close();
    await watcher.close();
  });
});
