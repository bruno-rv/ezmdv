# Subfolder Drag-Out + Instant Project Merge — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make folder nodes draggable so they can be merged into another project or extracted as a new standalone project, and remove the confirmation dialog from project-to-project merging.

**Architecture:** Hoist `copyDirRecursive` to a shared helper in `projects.ts`, add two new POST endpoints, extend the drag/drop system with a new MIME type and a bottom-of-sidebar extraction drop zone.

**Tech Stack:** Express 5, Node.js fs (sync), React 19, TypeScript, Vitest, Tailwind CSS 4

---

## Chunk 1: Server — hoist helper + two new endpoints + tests

### Task 1: Hoist `copyDirRecursive` to a module-level helper

The function is currently defined inline inside the `merge-project` handler closure. Extract it so both new endpoints can share it.

**Files:**
- Modify: `packages/server/src/routes/projects.ts:487–501`

- [ ] **Step 1: Move `copyDirRecursive` above the first router handler**

In `packages/server/src/routes/projects.ts`, cut the function definition from inside the `merge-project` handler (lines 487–501) and paste it at module level — just before the `export function createProjectRouter` line (or wherever the router factory starts). The signature stays identical:

```ts
function copyDirRecursive(src: string, dest: string, destRoot: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (!isPathWithinRoot(destPath, destRoot)) continue;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      copyDirRecursive(srcPath, destPath, destRoot);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
```

Inside the `merge-project` handler, remove the local definition — the call `copyDirRecursive(sourceProject.path, destSubfolder, destProject.path)` stays as-is and now resolves the module-level function.

- [ ] **Step 2: Build and verify existing tests still pass**

```bash
cd /Users/bruno/Claude/ezmdv
npm run build
npm test
```

Expected: all existing tests pass. No new failures.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/routes/projects.ts
git commit -m "refactor: hoist copyDirRecursive to module-level helper"
```

---

### Task 2: Add `POST /api/projects/:id/extract-subfolder`

**Files:**
- Modify: `packages/server/src/routes/projects.ts` (add route after `merge-project`)
- Modify: `packages/server/src/routes/projects.test.ts` (add tests)

- [ ] **Step 1: Write failing tests for `extract-subfolder`**

In `packages/server/src/routes/projects.test.ts`, first extend the existing import on line 8 to include the two new types:

```ts
import { readState, writeState, type AppState, type Project, type Tab } from '../state.js';
```

Then add a new `describe` block after the `merge-project` tests:

```ts
describe('POST /api/projects/:id/extract-subfolder', () => {
  it('moves subfolder to a new upload project and remaps tabs', async () => {
    // Create a source project with a subfolder
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    const subDir = path.join(srcDir, 'notes');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'file.md'), '# Hello');
    const src = { id: 'src1', name: 'Source', path: srcDir, source: 'cli' as const, lastOpened: '' };

    // Seed state with source project and an open tab inside the subfolder
    writeState({
      projects: [src],
      openTabs: [{ projectId: 'src1', filePath: 'notes/file.md' }],
      checkboxStates: { 'src1:notes/file.md': { 'item': true } },
      theme: 'light',
      dismissedCliPaths: [],
    }, statePath);

    const res = await request(app)
      .post(`/api/projects/src1/extract-subfolder`)
      .send({ subfolderPath: 'notes' });

    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('notes');

    // Subfolder removed from source
    expect(fs.existsSync(subDir)).toBe(false);

    // New project files exist
    const newPath = res.body.project.path as string;
    expect(fs.existsSync(path.join(newPath, 'file.md'))).toBe(true);

    // State: new project in list, tab remapped
    const state = readState(statePath);
    const newProject = state.projects.find((p: Project) => p.id === res.body.project.id);
    expect(newProject).toBeDefined();
    const remappedTab = state.openTabs.find((t: Tab) => t.projectId === res.body.project.id);
    expect(remappedTab?.filePath).toBe('file.md');
    // Old tab gone
    expect(state.openTabs.find((t: Tab) => t.projectId === 'src1' && t.filePath === 'notes/file.md')).toBeUndefined();

    // checkboxStates remapped
    const newKey = `${res.body.project.id}:file.md`;
    expect(state.checkboxStates[newKey]).toEqual({ item: true });
    expect(state.checkboxStates['src1:notes/file.md']).toBeUndefined();

    // Cleanup
    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(newPath, { recursive: true, force: true });
  });

  it('rejects path traversal', async () => {
    const src = { id: 'src2', name: 'Source', path: '/tmp/safe', source: 'cli' as const, lastOpened: '' };
    writeState({ projects: [src], openTabs: [], checkboxStates: {}, theme: 'light', dismissedCliPaths: [] }, statePath);
    const res = await request(app)
      .post('/api/projects/src2/extract-subfolder')
      .send({ subfolderPath: '../escape' });
    expect([403, 404]).toContain(res.status);
  });

  it('rejects non-directory path', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    fs.writeFileSync(path.join(srcDir, 'file.md'), '# hi');
    const src = { id: 'src3', name: 'Source', path: srcDir, source: 'cli' as const, lastOpened: '' };
    writeState({ projects: [src], openTabs: [], checkboxStates: {}, theme: 'light', dismissedCliPaths: [] }, statePath);
    const res = await request(app)
      .post('/api/projects/src3/extract-subfolder')
      .send({ subfolderPath: 'file.md' });
    expect(res.status).toBe(400);
    fs.rmSync(srcDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npm test -- --reporter=verbose 2>&1 | grep -A2 'extract-subfolder'
```

Expected: 3 failing tests (route doesn't exist yet).

- [ ] **Step 3: Implement the endpoint**

After the closing `});` of the `merge-project` handler (around line 560 of `projects.ts`), add:

```ts
// POST /api/projects/:id/extract-subfolder
router.post('/:id/extract-subfolder', withProject, (req: Request, res: Response) => {
  const { project: sourceProject } = req as ProjectRequest;
  const { subfolderPath } = req.body as { subfolderPath?: string };

  if (!subfolderPath) {
    res.status(400).json({ error: 'subfolderPath is required' });
    return;
  }

  const srcDir = path.join(sourceProject.path, subfolderPath);
  if (!isPathWithinRoot(srcDir, sourceProject.path)) {
    res.status(403).json({ error: 'Path traversal detected' });
    return;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(srcDir);
  } catch {
    res.status(400).json({ error: 'Path does not exist' });
    return;
  }
  if (!stat.isDirectory()) {
    res.status(400).json({ error: 'Path is not a directory' });
    return;
  }

  const folderName = path.basename(subfolderPath);
  const newId = uuidv4();
  const safeName = folderName.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  let newProjectPath = path.join(os.homedir(), '.ezmdv', 'uploads', safeName);
  if (fs.existsSync(newProjectPath)) {
    newProjectPath = path.join(os.homedir(), '.ezmdv', 'uploads', `${safeName}_${newId.slice(0, 6)}`);
  }

  try {
    copyDirRecursive(srcDir, newProjectPath, newProjectPath);
  } catch {
    res.status(500).json({ error: 'Failed to copy files' });
    return;
  }

  try {
    fs.rmSync(srcDir, { recursive: true, force: true });
  } catch {
    // best effort
  }

  const newProject: Project = {
    id: newId,
    name: folderName,
    source: 'upload',
    path: newProjectPath,
    lastOpened: new Date().toISOString(),
  };

  const state = readState(statePath);
  state.projects.push(newProject);

  const prefix = subfolderPath + '/';
  state.openTabs = state.openTabs.map((t) => {
    if (t.projectId === sourceProject.id && t.filePath.startsWith(prefix)) {
      return { projectId: newId, filePath: t.filePath.slice(prefix.length) };
    }
    return t;
  });

  const newCheckboxStates: Record<string, Record<string, boolean>> = {};
  const oldKeyPrefix = `${sourceProject.id}:${prefix}`;
  for (const [key, value] of Object.entries(state.checkboxStates)) {
    if (key.startsWith(oldKeyPrefix)) {
      const filePart = key.slice(oldKeyPrefix.length);
      newCheckboxStates[`${newId}:${filePart}`] = value;
    } else {
      newCheckboxStates[key] = value;
    }
  }
  state.checkboxStates = newCheckboxStates;

  updateState(
    {
      projects: state.projects,
      openTabs: state.openTabs,
      checkboxStates: state.checkboxStates,
    },
    statePath,
  );

  res.json({ project: newProject });
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/server && npm test -- --reporter=verbose 2>&1 | grep -A2 'extract-subfolder'
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/projects.ts packages/server/src/routes/projects.test.ts
git commit -m "feat(server): add extract-subfolder endpoint"
```

---

### Task 3: Add `POST /api/projects/:destId/merge-subfolder`

**Files:**
- Modify: `packages/server/src/routes/projects.ts`
- Modify: `packages/server/src/routes/projects.test.ts`

- [ ] **Step 1: Write failing tests for `merge-subfolder`**

Add another `describe` block in `projects.test.ts`:

```ts
describe('POST /api/projects/:id/merge-subfolder', () => {
  it('moves subfolder into destination project and remaps tabs', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dest-'));
    const subDir = path.join(srcDir, 'notes');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'a.md'), '# A');

    const src = { id: 'msrc1', name: 'Source', path: srcDir, source: 'cli' as const, lastOpened: '' };
    const dest = { id: 'mdst1', name: 'Dest', path: destDir, source: 'cli' as const, lastOpened: '' };
    writeState({
      projects: [src, dest],
      openTabs: [{ projectId: 'msrc1', filePath: 'notes/a.md' }],
      checkboxStates: { 'msrc1:notes/a.md': { 'cb': true } },
      theme: 'light',
      dismissedCliPaths: [],
    }, statePath);

    const res = await request(app)
      .post('/api/projects/mdst1/merge-subfolder')
      .send({ sourceProjectId: 'msrc1', subfolderPath: 'notes' });

    expect(res.status).toBe(200);
    expect(res.body.merged).toBe(true);
    expect(res.body.subfolderName).toBe('notes');

    // File moved to dest
    expect(fs.existsSync(path.join(destDir, 'notes', 'a.md'))).toBe(true);
    // Subfolder removed from source
    expect(fs.existsSync(subDir)).toBe(false);

    // Tab remapped to dest project
    const state = readState(statePath);
    expect(state.openTabs.find((t: Tab) => t.projectId === 'mdst1' && t.filePath === 'notes/a.md')).toBeDefined();
    expect(state.openTabs.find((t: Tab) => t.projectId === 'msrc1')).toBeUndefined();
    // checkboxStates remapped
    expect(state.checkboxStates['mdst1:notes/a.md']).toEqual({ cb: true });
    expect(state.checkboxStates['msrc1:notes/a.md']).toBeUndefined();

    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(destDir, { recursive: true, force: true });
  });

  it('rejects when destination already has a folder with the same name', async () => {
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dest-'));
    fs.mkdirSync(path.join(srcDir, 'notes'));
    fs.mkdirSync(path.join(destDir, 'notes')); // collision
    const src = { id: 'msrc2', name: 'Src', path: srcDir, source: 'cli' as const, lastOpened: '' };
    const dest = { id: 'mdst2', name: 'Dst', path: destDir, source: 'cli' as const, lastOpened: '' };
    writeState({ projects: [src, dest], openTabs: [], checkboxStates: {}, theme: 'light', dismissedCliPaths: [] }, statePath);

    const res = await request(app)
      .post('/api/projects/mdst2/merge-subfolder')
      .send({ sourceProjectId: 'msrc2', subfolderPath: 'notes' });

    expect(res.status).toBe(409);
    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(destDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/server && npm test -- --reporter=verbose 2>&1 | grep -A2 'merge-subfolder'
```

Expected: 2 failing.

- [ ] **Step 3: Implement the endpoint**

After the `extract-subfolder` handler, add:

```ts
// POST /api/projects/:id/merge-subfolder
router.post('/:id/merge-subfolder', withProject, (req: Request, res: Response) => {
  const { project: destProject } = req as ProjectRequest;
  const { sourceProjectId, subfolderPath } = req.body as {
    sourceProjectId?: string;
    subfolderPath?: string;
  };

  if (!sourceProjectId || !subfolderPath) {
    res.status(400).json({ error: 'sourceProjectId and subfolderPath are required' });
    return;
  }

  const state = readState(statePath);
  const sourceProject = state.projects.find((p) => p.id === sourceProjectId);
  if (!sourceProject) {
    res.status(404).json({ error: 'Source project not found' });
    return;
  }

  const srcDir = path.join(sourceProject.path, subfolderPath);
  if (!isPathWithinRoot(srcDir, sourceProject.path)) {
    res.status(403).json({ error: 'Path traversal detected' });
    return;
  }

  const folderName = path.basename(subfolderPath);
  const destSubdir = path.join(destProject.path, folderName);

  if (fs.existsSync(destSubdir)) {
    res.status(409).json({ error: `Subfolder "${folderName}" already exists in destination` });
    return;
  }

  try {
    copyDirRecursive(srcDir, destSubdir, destProject.path);
  } catch {
    res.status(500).json({ error: 'Failed to copy files' });
    return;
  }

  try {
    fs.rmSync(srcDir, { recursive: true, force: true });
  } catch {
    // best effort
  }

  const prefix = subfolderPath + '/';
  state.openTabs = state.openTabs.map((t) => {
    if (t.projectId === sourceProjectId && t.filePath.startsWith(prefix)) {
      return { projectId: destProject.id, filePath: `${folderName}/${t.filePath.slice(prefix.length)}` };
    }
    return t;
  });

  const newCheckboxStates: Record<string, Record<string, boolean>> = {};
  const oldKeyPrefix = `${sourceProjectId}:${prefix}`;
  for (const [key, value] of Object.entries(state.checkboxStates)) {
    if (key.startsWith(oldKeyPrefix)) {
      const filePart = key.slice(oldKeyPrefix.length);
      newCheckboxStates[`${destProject.id}:${folderName}/${filePart}`] = value;
    } else {
      newCheckboxStates[key] = value;
    }
  }
  state.checkboxStates = newCheckboxStates;

  updateState(
    {
      openTabs: state.openTabs,
      checkboxStates: state.checkboxStates,
    },
    statePath,
  );

  res.json({ merged: true, subfolderName: folderName });
});
```

- [ ] **Step 4: Run all server tests**

```bash
cd packages/server && npm test
```

Expected: all tests pass including all 5 new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/projects.ts packages/server/src/routes/projects.test.ts
git commit -m "feat(server): add merge-subfolder endpoint"
```

---

## Chunk 2: Client — API, hooks, components, App

### Task 4: Add API client functions

**Files:**
- Modify: `packages/web/src/lib/api.ts` (after `mergeProjectInto`, around line 286)

- [ ] **Step 1: Add `extractSubfolder` and `mergeSubfolderInto` to `api.ts`**

After the closing `}` of `mergeProjectInto` (line 286), insert:

```ts
export async function extractSubfolder(
  projectId: string,
  subfolderPath: string,
): Promise<{ project: Project }> {
  return request<{ project: Project }>(
    `/api/projects/${projectId}/extract-subfolder`,
    {
      method: 'POST',
      body: JSON.stringify({ subfolderPath }),
    },
  );
}

export async function mergeSubfolderInto(
  destProjectId: string,
  sourceProjectId: string,
  subfolderPath: string,
): Promise<MergeProjectResponse> {
  return request<MergeProjectResponse>(
    `/api/projects/${destProjectId}/merge-subfolder`,
    {
      method: 'POST',
      body: JSON.stringify({ sourceProjectId, subfolderPath }),
    },
  );
}
```

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
cd packages/web && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat(web): add extractSubfolder and mergeSubfolderInto API functions"
```

---

### Task 5: Add hooks to `useProjects`

**Files:**
- Modify: `packages/web/src/hooks/useProjects.ts` (after `mergeProject`, around line 145)

- [ ] **Step 1: Import new API functions and add hooks**

At the top of `useProjects.ts`, update the import from `'@/lib/api'` (lines 2–16) to add the two new functions:

```ts
import {
  fetchProjects,
  fetchProjectFiles,
  createProject,
  uploadFiles,
  deleteProject,
  renameProject as apiRenameProject,
  moveFile,
  createFolder,
  mergeProjectInto,
  extractSubfolder as extractSubfolderApi,
  mergeSubfolderInto,
  type Project,
  type FileTreeEntry,
  type MoveFileResponse,
  type MergeProjectResponse,
} from '@/lib/api';
```

After the closing of `mergeProject` (line 145), insert:

```ts
const extractSubfolder = useCallback(
  async (projectId: string, subfolderPath: string) => {
    const result = await extractSubfolderApi(projectId, subfolderPath);
    setProjects((prev) => [...prev, { ...result.project, files: null, filesLoading: false }]);
    await loadProjectFiles(projectId);
    return result;
  },
  [loadProjectFiles],
);

const mergeSubfolder = useCallback(
  async (destProjectId: string, sourceProjectId: string, subfolderPath: string) => {
    const result = await mergeSubfolderInto(destProjectId, sourceProjectId, subfolderPath);
    await Promise.all([
      loadProjectFiles(destProjectId),
      loadProjectFiles(sourceProjectId),
    ]);
    return result;
  },
  [loadProjectFiles],
);
```

Add both to the `return` object at the bottom of the hook (around line 160):

```ts
return {
  projects,
  loading,
  loadProjects,
  loadProjectFiles,
  addProject,
  renameProject,
  removeProject,
  removeProjects,
  uploadToProject,
  moveFileBetweenProjects,
  createProjectFolder,
  mergeProject,
  extractSubfolder,
  mergeSubfolder,
};
```

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
cd packages/web && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/hooks/useProjects.ts
git commit -m "feat(web): add extractSubfolder and mergeSubfolder hooks"
```

---

### Task 6: Make folder nodes draggable in `FileTreeNode`

**Files:**
- Modify: `packages/web/src/components/FileTreeNode.tsx`

- [ ] **Step 1: Add props and drag behaviour to directory nodes**

In `FileTreeNode.tsx`, add two new optional props to the interface and destructuring:

```ts
interface FileTreeNodeProps {
  // ... existing props ...
  onFolderDragStart?: () => void;
  onFolderDragEnd?: () => void;
}
```

In the directory branch (`if (entry.type === 'directory')`), change the outer `<div>` and the `<button>` inside:

```tsx
// Replace the outer <div> wrapper:
<div
  draggable
  onDragStart={(e) => {
    e.dataTransfer.setData(
      'application/x-ezmdv-folder',
      JSON.stringify({ projectId, folderPath: entry.path, folderName: entry.name }),
    );
    e.dataTransfer.effectAllowed = 'move';
    onFolderDragStart?.();
  }}
  onDragEnd={() => onFolderDragEnd?.()}
>
  <div className="group flex items-center">
    {/* existing button + FolderPlus button unchanged */}
  </div>
  {/* existing expanded children unchanged */}
</div>
```

In the recursive `FileTreeNode` calls (lines 91–100), pass the new props through:

```tsx
<FileTreeNode
  key={child.path}
  entry={child}
  projectId={projectId}
  activeTab={activeTab}
  depth={depth + 1}
  onFileClick={onFileClick}
  onCreateFolder={onCreateFolder}
  draggable={draggable}
  onFolderDragStart={onFolderDragStart}
  onFolderDragEnd={onFolderDragEnd}
/>
```

- [ ] **Step 2: Build to confirm**

```bash
cd packages/web && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/FileTreeNode.tsx
git commit -m "feat(web): make folder nodes draggable with x-ezmdv-folder MIME type"
```

---

### Task 7: Thread folder drag callbacks through `ExpandedProjectContent`

**Files:**
- Modify: `packages/web/src/components/ExpandedProjectContent.tsx`

- [ ] **Step 1: Add props and forward to `FileTreeNode`**

In `ExpandedProjectContent.tsx`, add to the props interface:

```ts
interface ExpandedProjectContentProps {
  // ... existing props ...
  onFolderDragStart?: () => void;
  onFolderDragEnd?: () => void;
}
```

Destructure them in the function signature, then pass to each `FileTreeNode` in the `visibleEntries.map(...)` block:

```tsx
<FileTreeNode
  key={entry.path}
  entry={entry}
  projectId={project.id}
  activeTab={activeTab}
  depth={1}
  onFileClick={onFileClick}
  onCreateFolder={onCreateFolder}
  draggable={draggable}
  onFolderDragStart={onFolderDragStart}
  onFolderDragEnd={onFolderDragEnd}
/>
```

- [ ] **Step 2: Build to confirm**

```bash
cd packages/web && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/ExpandedProjectContent.tsx
git commit -m "feat(web): thread onFolderDragStart/End through ExpandedProjectContent"
```

---

### Task 8: Update `Sidebar` — drop targets + extraction zone

**Files:**
- Modify: `packages/web/src/components/Sidebar.tsx`

- [ ] **Step 1: Add new props to interface and destructure**

Add to `SidebarProps`:

```ts
onMergeSubfolder?: (destProjectId: string, sourceProjectId: string, folderPath: string) => void;
onExtractSubfolder?: (sourceProjectId: string, folderPath: string) => void;
```

Add to the function destructuring and thread `onFolderDragStart`/`onFolderDragEnd` to `ExpandedProjectContent` calls.

- [ ] **Step 2: Add `isFolderDragging` state and document `dragend` listener**

After existing state declarations (around line 90), add:

```ts
const [isFolderDragging, setIsFolderDragging] = useState(false);
const [extractDropActive, setExtractDropActive] = useState(false);
const extractDropCounter = useRef(0);
```

Add a `useEffect` to reset on document `dragend` (handles drag cancelled outside window):

```ts
useEffect(() => {
  const reset = () => {
    setIsFolderDragging(false);
    setExtractDropActive(false);
    extractDropCounter.current = 0;
  };
  document.addEventListener('dragend', reset);
  return () => document.removeEventListener('dragend', reset);
}, []);
```

Pass callbacks to `ExpandedProjectContent`:

```tsx
onFolderDragStart={() => setIsFolderDragging(true)}
onFolderDragEnd={() => { setIsFolderDragging(false); setExtractDropActive(false); extractDropCounter.current = 0; }}
```

- [ ] **Step 3: Extend project header drag handlers to accept folder drops**

In the `onDragOver` handler on the project `<div>` (lines 388–397), extend the type check:

```ts
onDragOver={(e) => {
  if (
    e.dataTransfer.types.includes('application/x-ezmdv-file') ||
    e.dataTransfer.types.includes('application/x-ezmdv-project') ||
    e.dataTransfer.types.includes('application/x-ezmdv-folder')
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetProjectId(project.id);
  }
}}
```

In `onDrop` (lines 403–433), add handling for folder drops before the existing project drop check:

```ts
onDrop={(e) => {
  setDropTargetProjectId(null);

  const folderRaw = e.dataTransfer.getData('application/x-ezmdv-folder');
  if (folderRaw && onMergeSubfolder) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { projectId: srcProjectId, folderPath } = JSON.parse(folderRaw) as {
        projectId: string;
        folderPath: string;
        folderName: string;
      };
      if (srcProjectId !== project.id) {
        setIsFolderDragging(false);
        onMergeSubfolder(project.id, srcProjectId, folderPath);
      }
    } catch {
      // ignore
    }
    return;
  }

  // ... existing project and file drop handling unchanged ...
}}
```

- [ ] **Step 4: Add the extraction drop zone**

Just after the closing `</div>` of the projects `.map()` container (line 541 — the `</div>` that closes `{... .map((project) => { ... })}` and then its wrapping `</div>`), insert before the select-mode bulk action bar:

```tsx
{isFolderDragging && (
  <div
    className={cn(
      'mx-3 mb-2 rounded border-2 border-dashed px-3 py-4 text-center text-xs text-muted-foreground transition-colors',
      extractDropActive
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border',
    )}
    onDragOver={(e) => {
      if (e.dataTransfer.types.includes('application/x-ezmdv-folder')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }
    }}
    onDragEnter={(e) => {
      if (e.dataTransfer.types.includes('application/x-ezmdv-folder')) {
        extractDropCounter.current += 1;
        setExtractDropActive(true);
      }
    }}
    onDragLeave={() => {
      extractDropCounter.current -= 1;
      if (extractDropCounter.current === 0) setExtractDropActive(false);
    }}
    onDrop={(e) => {
      extractDropCounter.current = 0;
      setExtractDropActive(false);
      setIsFolderDragging(false);
      const raw = e.dataTransfer.getData('application/x-ezmdv-folder');
      if (!raw || !onExtractSubfolder) return;
      e.preventDefault();
      try {
        const { projectId, folderPath } = JSON.parse(raw) as {
          projectId: string;
          folderPath: string;
          folderName: string;
        };
        onExtractSubfolder(projectId, folderPath);
      } catch {
        // ignore
      }
    }}
  >
    Drop to create new project
  </div>
)}
```

- [ ] **Step 5: Build to confirm**

```bash
cd packages/web && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/Sidebar.tsx
git commit -m "feat(web): add folder drop targets and extraction zone to Sidebar"
```

---

### Task 9: Wire everything in `App.tsx`

**Files:**
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Remove `window.confirm()` from `handleMergeProject`**

In `App.tsx` around lines 584–590, delete the `if (!window.confirm(...)) { return; }` block. The handler becomes:

```ts
const handleMergeProject = useCallback(
  (destProjectId: string, sourceProjectId: string) => {
    const source = projects.find((p) => p.id === sourceProjectId);
    const dest = projects.find((p) => p.id === destProjectId);
    if (!source || !dest) {
      alert('Could not find one of the projects.');
      return;
    }
    mergeProject(destProjectId, sourceProjectId)
      .then(() => {
        closeProjectTabs(sourceProjectId);
        if (graphProjectId === sourceProjectId) {
          setGraphProjectId(null);
          setGraphData(null);
        }
      })
      .catch((error) => {
        alert(error instanceof Error ? error.message : 'Merge failed.');
      });
  },
  [closeProjectTabs, graphProjectId, mergeProject, projects],
);
```

- [ ] **Step 2: Add `handleMergeSubfolder` and `handleExtractSubfolder`**

After `handleMergeProject`, add:

```ts
const handleMergeSubfolder = useCallback(
  (destProjectId: string, sourceProjectId: string, folderPath: string) => {
    mergeSubfolder(destProjectId, sourceProjectId, folderPath).catch((error) => {
      alert(error instanceof Error ? error.message : 'Merge subfolder failed.');
    });
  },
  [mergeSubfolder],
);

const handleExtractSubfolder = useCallback(
  (sourceProjectId: string, folderPath: string) => {
    extractSubfolder(sourceProjectId, folderPath).catch((error) => {
      alert(error instanceof Error ? error.message : 'Extract subfolder failed.');
    });
  },
  [extractSubfolder],
);
```

In `App.tsx`, update the `useProjects()` destructuring (around line 83–88) to include the two new hooks:

```ts
const {
  projects,
  loading: projectsLoading,
  loadProjects,
  loadProjectFiles,
  addProject,
  renameProject,
  removeProject,
  removeProjects,
  uploadToProject,
  moveFileBetweenProjects,
  createProjectFolder,
  mergeProject,
  extractSubfolder,
  mergeSubfolder,
} = useProjects();
```

(Keep all existing destructured names; just append `extractSubfolder` and `mergeSubfolder`.)

- [ ] **Step 3: Pass new props to `<Sidebar />`**

In the `<Sidebar />` JSX, add:

```tsx
onMergeSubfolder={handleMergeSubfolder}
onExtractSubfolder={handleExtractSubfolder}
```

- [ ] **Step 4: Build the full project**

```bash
cd /Users/bruno/Claude/ezmdv && npm run build 2>&1 | tail -10
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/App.tsx
git commit -m "feat(web): wire subfolder drag handlers and remove merge confirmation"
```

---

### Task 10: Update README + push

- [ ] **Step 1: Update README.md**

In the root `README.md`, find the section describing drag-and-drop or project management and add:

- Under project interactions: "Drag a **subfolder** from the file tree onto another project header to merge it as a subfolder of that project. Drag it to the **drop zone below the project list** to extract it as a new standalone project."
- Remove or update any mention of a confirmation dialog for project merging.

- [ ] **Step 2: Final build + test**

```bash
cd /Users/bruno/Claude/ezmdv && npm run build && npm test
```

Expected: all green.

- [ ] **Step 3: Commit README**

```bash
git add README.md
git commit -m "docs: document subfolder drag-out and instant merge in README"
```

- [ ] **Step 4: Push to remote**

```bash
git push
```
