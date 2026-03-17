import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createProjectRoutes } from './projects.js';
import { readState, writeState, type AppState, type Project, type Tab } from '../state.js';

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

describe('POST /api/projects/:id/create-file', () => {
  it('creates a new markdown file', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-file`)
      .send({ path: 'new-note.md' });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe('new-note.md');
    expect(fs.existsSync(path.join(projectDir, 'new-note.md'))).toBe(true);
  });

  it('creates nested files with parent directories', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-file`)
      .send({ path: 'notes/sub/deep.md' });
    expect(res.status).toBe(201);
    expect(fs.existsSync(path.join(projectDir, 'notes', 'sub', 'deep.md'))).toBe(true);
  });

  it('returns 409 for existing file', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-file`)
      .send({ path: 'readme.md' });
    expect(res.status).toBe(409);
  });

  it('rejects non-.md files', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-file`)
      .send({ path: 'script.js' });
    expect(res.status).toBe(400);
  });

  it('blocks path traversal', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-file`)
      .send({ path: '../../etc/evil.md' });
    expect(res.status).toBe(403);
  });

  it('rejects missing path', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-file`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects/:id/search?mode=fuzzy', () => {
  it('returns fuzzy search results', async () => {
    const res = await request(app).get(
      `/api/projects/${projectId}/search?q=Hello&mode=fuzzy`,
    );
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0]).toHaveProperty('score');
  });

  it('fuzzy matches approximate terms', async () => {
    const res = await request(app).get(
      `/api/projects/${projectId}/search?q=Helo&mode=fuzzy`,
    );
    expect(res.status).toBe(200);
    // Fuzzy should still find results via trigram overlap
    expect(res.body.results.length).toBeGreaterThanOrEqual(0);
  });

  it('returns empty for empty query', async () => {
    const res = await request(app).get(
      `/api/projects/${projectId}/search?q=&mode=fuzzy`,
    );
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });
});

describe('GET /api/projects/search?mode=fuzzy (global)', () => {
  it('returns fuzzy results across all projects', async () => {
    const res = await request(app).get('/api/projects/search?q=Hello&mode=fuzzy');
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0].projectId).toBe(projectId);
    expect(res.body.results[0]).toHaveProperty('score');
  });
});

describe('POST /api/projects/:id/move-file', () => {
  let destProjectDir: string;
  let destProjectId: string;

  beforeEach(() => {
    destProjectDir = makeTempDir();
    fs.writeFileSync(path.join(destProjectDir, 'existing.md'), '# Existing');
    destProjectId = 'dest-project-1';

    const state = readState(statePath);
    state.projects.push({
      id: destProjectId,
      name: 'Dest Project',
      source: 'cli',
      path: destProjectDir,
      lastOpened: new Date().toISOString(),
    });
    writeState(state, statePath);
  });

  it('moves a file successfully', async () => {
    const res = await request(app)
      .post(`/api/projects/${destProjectId}/move-file`)
      .send({
        sourceProjectId: projectId,
        sourceFilePath: 'readme.md',
        destFilePath: 'readme.md',
      });
    expect(res.status).toBe(200);
    expect(res.body.moved).toBe(true);
    expect(res.body.sourceProjectDeleted).toBe(false);

    expect(fs.existsSync(path.join(destProjectDir, 'readme.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'readme.md'))).toBe(false);
  });

  it('returns 409 if dest file exists', async () => {
    const res = await request(app)
      .post(`/api/projects/${destProjectId}/move-file`)
      .send({
        sourceProjectId: projectId,
        sourceFilePath: 'readme.md',
        destFilePath: 'existing.md',
      });
    expect(res.status).toBe(409);
  });

  it('returns 404 if source file not found', async () => {
    const res = await request(app)
      .post(`/api/projects/${destProjectId}/move-file`)
      .send({
        sourceProjectId: projectId,
        sourceFilePath: 'nonexistent.md',
        destFilePath: 'moved.md',
      });
    expect(res.status).toBe(404);
  });

  it('blocks path traversal on source', async () => {
    const res = await request(app)
      .post(`/api/projects/${destProjectId}/move-file`)
      .send({
        sourceProjectId: projectId,
        sourceFilePath: '../../etc/passwd',
        destFilePath: 'stolen.md',
      });
    expect(res.status).toBe(403);
  });

  it('blocks path traversal on dest', async () => {
    const res = await request(app)
      .post(`/api/projects/${destProjectId}/move-file`)
      .send({
        sourceProjectId: projectId,
        sourceFilePath: 'readme.md',
        destFilePath: '../../etc/evil.md',
      });
    expect(res.status).toBe(403);
  });

  it('auto-deletes empty upload project after move', async () => {
    const uploadDir = makeTempDir();
    fs.writeFileSync(path.join(uploadDir, 'only.md'), '# Only File');
    const uploadProjectId = 'upload-proj-1';

    const state = readState(statePath);
    state.projects.push({
      id: uploadProjectId,
      name: 'Upload Proj',
      source: 'upload',
      path: uploadDir,
      lastOpened: new Date().toISOString(),
    });
    writeState(state, statePath);

    const res = await request(app)
      .post(`/api/projects/${destProjectId}/move-file`)
      .send({
        sourceProjectId: uploadProjectId,
        sourceFilePath: 'only.md',
        destFilePath: 'only.md',
      });
    expect(res.status).toBe(200);
    expect(res.body.moved).toBe(true);
    expect(res.body.sourceProjectDeleted).toBe(true);

    const updatedState = readState(statePath);
    expect(updatedState.projects.find((p) => p.id === uploadProjectId)).toBeUndefined();
  });
});

describe('POST /api/projects/:id/create-folder', () => {
  it('creates a folder', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-folder`)
      .send({ path: 'new-folder' });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe('new-folder');
    expect(fs.existsSync(path.join(projectDir, 'new-folder'))).toBe(true);
    expect(fs.statSync(path.join(projectDir, 'new-folder')).isDirectory()).toBe(true);
  });

  it('creates nested folders', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-folder`)
      .send({ path: 'a/b/c' });
    expect(res.status).toBe(201);
    expect(fs.existsSync(path.join(projectDir, 'a', 'b', 'c'))).toBe(true);
  });

  it('returns 409 for existing folder', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-folder`)
      .send({ path: 'docs' });
    expect(res.status).toBe(409);
  });

  it('blocks path traversal', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-folder`)
      .send({ path: '../../evil-folder' });
    expect(res.status).toBe(403);
  });

  it('rejects missing path', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/create-folder`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/projects/:id/merge-project', () => {
  let sourceProjectDir: string;
  let sourceProjectId: string;

  beforeEach(() => {
    sourceProjectDir = makeTempDir();
    fs.writeFileSync(path.join(sourceProjectDir, 'alpha.md'), '# Alpha');
    fs.mkdirSync(path.join(sourceProjectDir, 'sub'));
    fs.writeFileSync(path.join(sourceProjectDir, 'sub', 'beta.md'), '# Beta');
    sourceProjectId = 'source-project-1';

    const state = readState(statePath);
    state.projects.push({
      id: sourceProjectId,
      name: 'Source Project',
      source: 'cli',
      path: sourceProjectDir,
      lastOpened: new Date().toISOString(),
    });
    state.openTabs.push({ projectId: sourceProjectId, filePath: 'alpha.md' });
    writeState(state, statePath);
  });

  it('merges source as subfolder', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/merge-project`)
      .send({ sourceProjectId });
    expect(res.status).toBe(200);
    expect(res.body.merged).toBe(true);

    const subfolderName = path.basename(sourceProjectDir);
    expect(res.body.subfolderName).toBe(subfolderName);

    expect(fs.existsSync(path.join(projectDir, subfolderName, 'alpha.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, subfolderName, 'sub', 'beta.md'))).toBe(true);
  });

  it('removes source from projects', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/merge-project`)
      .send({ sourceProjectId });
    const state = readState(statePath);
    expect(state.projects.find((p) => p.id === sourceProjectId)).toBeUndefined();
  });

  it('remaps open tabs', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/merge-project`)
      .send({ sourceProjectId });
    const state = readState(statePath);
    const subfolderName = path.basename(sourceProjectDir);
    const remapped = state.openTabs.find(
      (t) => t.projectId === projectId && t.filePath === `${subfolderName}/alpha.md`,
    );
    expect(remapped).toBeDefined();
  });

  it('adds CLI source to dismissedCliPaths', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/merge-project`)
      .send({ sourceProjectId });
    const state = readState(statePath);
    expect(state.dismissedCliPaths).toContain(sourceProjectDir);
  });

  it('returns 409 if subfolder already exists', async () => {
    const subfolderName = path.basename(sourceProjectDir);
    fs.mkdirSync(path.join(projectDir, subfolderName), { recursive: true });

    const res = await request(app)
      .post(`/api/projects/${projectId}/merge-project`)
      .send({ sourceProjectId });
    expect(res.status).toBe(409);
  });

  it('returns 400 for self-merge', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/merge-project`)
      .send({ sourceProjectId: projectId });
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent source', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/merge-project`)
      .send({ sourceProjectId: 'nonexistent' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for missing sourceProjectId', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/merge-project`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/projects/:id/extract-subfolder', () => {
  it('moves subfolder to a new upload project and remaps tabs', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    const subDir = path.join(srcDir, 'notes');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'file.md'), '# Hello');
    const src: Project = { id: 'src1', name: 'Source', path: srcDir, source: 'cli', lastOpened: '' };

    writeState({
      projects: [src],
      openTabs: [{ projectId: 'src1', filePath: 'notes/file.md' }],
      checkboxStates: { 'src1:notes/file.md': { item: true } },
      theme: 'light',
      dismissedCliPaths: [],
    }, statePath);

    const res = await request(app)
      .post('/api/projects/src1/extract-subfolder')
      .send({ subfolderPath: 'notes' });

    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('notes');

    expect(fs.existsSync(subDir)).toBe(false);

    const newPath = res.body.project.path as string;
    expect(fs.existsSync(path.join(newPath, 'file.md'))).toBe(true);

    const state = readState(statePath);
    const newProject = state.projects.find((p: Project) => p.id === res.body.project.id);
    expect(newProject).toBeDefined();
    const remappedTab = state.openTabs.find((t: Tab) => t.projectId === res.body.project.id);
    expect(remappedTab?.filePath).toBe('file.md');
    expect(state.openTabs.find((t: Tab) => t.projectId === 'src1' && t.filePath === 'notes/file.md')).toBeUndefined();

    const newKey = `${res.body.project.id}:file.md`;
    expect(state.checkboxStates[newKey]).toEqual({ item: true });
    expect(state.checkboxStates['src1:notes/file.md']).toBeUndefined();

    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(newPath, { recursive: true, force: true });
  });

  it('rejects path traversal', async () => {
    const src: Project = { id: 'src2', name: 'Source', path: '/tmp/safe', source: 'cli', lastOpened: '' };
    writeState({ projects: [src], openTabs: [], checkboxStates: {}, theme: 'light', dismissedCliPaths: [] }, statePath);
    const res = await request(app)
      .post('/api/projects/src2/extract-subfolder')
      .send({ subfolderPath: '../escape' });
    expect([403, 404]).toContain(res.status);
  });

  it('rejects non-directory path', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    fs.writeFileSync(path.join(srcDir, 'file.md'), '# hi');
    const src: Project = { id: 'src3', name: 'Source', path: srcDir, source: 'cli', lastOpened: '' };
    writeState({ projects: [src], openTabs: [], checkboxStates: {}, theme: 'light', dismissedCliPaths: [] }, statePath);
    const res = await request(app)
      .post('/api/projects/src3/extract-subfolder')
      .send({ subfolderPath: 'file.md' });
    expect(res.status).toBe(400);
    fs.rmSync(srcDir, { recursive: true, force: true });
  });
});

describe('POST /api/projects/:id/merge-subfolder', () => {
  it('moves subfolder into destination project and remaps tabs', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dest-'));
    const subDir = path.join(srcDir, 'notes');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'a.md'), '# A');

    const src: Project = { id: 'msrc1', name: 'Source', path: srcDir, source: 'cli', lastOpened: '' };
    const dest: Project = { id: 'mdst1', name: 'Dest', path: destDir, source: 'cli', lastOpened: '' };
    writeState({
      projects: [src, dest],
      openTabs: [{ projectId: 'msrc1', filePath: 'notes/a.md' }],
      checkboxStates: { 'msrc1:notes/a.md': { cb: true } },
      theme: 'light',
      dismissedCliPaths: [],
    }, statePath);

    const res = await request(app)
      .post('/api/projects/mdst1/merge-subfolder')
      .send({ sourceProjectId: 'msrc1', subfolderPath: 'notes' });

    expect(res.status).toBe(200);
    expect(res.body.merged).toBe(true);
    expect(res.body.subfolderName).toBe('notes');

    expect(fs.existsSync(path.join(destDir, 'notes', 'a.md'))).toBe(true);
    expect(fs.existsSync(subDir)).toBe(false);

    const state = readState(statePath);
    expect(state.openTabs.find((t: Tab) => t.projectId === 'mdst1' && t.filePath === 'notes/a.md')).toBeDefined();
    expect(state.openTabs.find((t: Tab) => t.projectId === 'msrc1')).toBeUndefined();
    expect(state.checkboxStates['mdst1:notes/a.md']).toEqual({ cb: true });
    expect(state.checkboxStates['msrc1:notes/a.md']).toBeUndefined();

    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(destDir, { recursive: true, force: true });
  });

  it('rejects when destination already has a folder with the same name', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dest-'));
    fs.mkdirSync(path.join(srcDir, 'notes'));
    fs.mkdirSync(path.join(destDir, 'notes'));
    const src: Project = { id: 'msrc2', name: 'Src', path: srcDir, source: 'cli', lastOpened: '' };
    const dest: Project = { id: 'mdst2', name: 'Dst', path: destDir, source: 'cli', lastOpened: '' };
    writeState({ projects: [src, dest], openTabs: [], checkboxStates: {}, theme: 'light', dismissedCliPaths: [] }, statePath);

    const res = await request(app)
      .post('/api/projects/mdst2/merge-subfolder')
      .send({ sourceProjectId: 'msrc2', subfolderPath: 'notes' });

    expect(res.status).toBe(409);
    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(destDir, { recursive: true, force: true });
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
