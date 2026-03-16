# Subfolder Drag-Out + Instant Project Merge — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Two related improvements to the drag-and-drop system:

1. **Subfolder extraction** — a folder inside a project can be dragged out and dropped either onto another project (merges as a subfolder) or onto the free area below the project list (becomes a standalone project). Files are physically moved on disk; the folder is removed from its parent.
2. **Remove merge confirmation** — the `window.confirm()` dialog before project-to-project merging is removed. Merge fires immediately on drop.

---

## Confirmation Removal

Remove the `window.confirm()` block from `handleMergeProject` in `App.tsx`. Keep the `alert()` on error. No other changes.

---

## Folder Drag — Overview

A folder node in the file tree becomes draggable. Two drop targets exist:

- **Project header** in the sidebar — folder merges into that project as a subfolder (files moved, folder removed from source)
- **Extraction drop zone** below the project list — folder becomes a new standalone upload project (files moved to `~/.ezmdv/uploads/<safeName>/`)

---

## MIME Type

`application/x-ezmdv-folder` with JSON payload:

```ts
{ projectId: string; folderPath: string; folderName: string }
```

`folderPath` is relative to the project root (e.g. `notes/archive`). `folderName` is the last path segment.

---

## Frontend Changes

### `FileTreeNode.tsx`

- Directory `<button>` nodes gain `draggable` and `onDragStart` (sets `application/x-ezmdv-folder`)
- Two new props: `onFolderDragStart?: () => void` and `onFolderDragEnd?: () => void` — called on each folder element's `dragstart`/`dragend` events. Since `FileTreeNode` is recursive, these props must be passed through every recursive `FileTreeNode` call so drag events on nested directories also bubble the callbacks up to the sidebar.

### `ExpandedProjectContent.tsx`

- Accepts and forwards `onFolderDragStart` / `onFolderDragEnd` props down to `FileTreeNode`

### `Sidebar.tsx`

- Tracks `isFolderDragging: boolean` state, set to `true` by `onFolderDragStart` and reset to `false` by `onFolderDragEnd`. A `dragend` listener is also attached to `document` (via `useEffect`) to ensure the state resets if the drag is cancelled outside the window.
- **Project headers**: `onDragOver` type-check list is extended to include `application/x-ezmdv-folder` so the visual drop highlight appears during folder drags. `onDrop` also handles `application/x-ezmdv-folder`: on folder drop, calls `onMergeSubfolder(destProjectId, sourceProjectId, folderPath)`.
- **Extraction drop zone**: A `div` rendered below the project list. Hidden when `!isFolderDragging`. When visible: dashed border, muted label "Drop to create new project". Uses counter-based `dragenter`/`dragleave` (same pattern as the app-level upload drop zone) to avoid flicker on child elements. `onDragOver` must call `e.preventDefault()` and set `e.dataTransfer.dropEffect = 'move'` (without this the browser will not fire `drop`). On drop, calls `onExtractSubfolder(sourceProjectId, folderPath)`.
- New props: `onMergeSubfolder`, `onExtractSubfolder`, `onFolderDragStart`, `onFolderDragEnd`

### `App.tsx`

- `handleMergeProject`: remove `window.confirm()`, merge fires immediately
- `handleMergeSubfolder(destProjectId, sourceProjectId, folderPath)`: calls `mergeSubfolder`; on success, source file tree refreshes automatically (files are gone from disk); on error, `alert()`
- `handleExtractSubfolder(sourceProjectId, folderPath)`: calls `extractSubfolder`, adds returned project to state; on error, `alert()`
- Wire new handlers as props to `Sidebar`

### `api.ts`

```ts
export async function extractSubfolder(
  projectId: string,
  subfolderPath: string,
): Promise<{ project: Project }>

// Reuses the existing MergeProjectResponse type { merged: boolean; subfolderName: string }
export async function mergeSubfolderInto(
  destProjectId: string,
  sourceProjectId: string,
  subfolderPath: string,
): Promise<MergeProjectResponse>
```

### `useProjects.ts`

- `extractSubfolder(projectId, subfolderPath)` — calls API, appends new project to state, reloads source project files (to reflect removed subfolder). Server-side tab remapping in the response is for persistence on restart only; live tab state is managed client-side by `useTabs` and requires no synchronous reconciliation here.
- `mergeSubfolder(destProjectId, sourceProjectId, subfolderPath)` — calls API, reloads both dest project files (new subfolder appeared) and source project files (subfolder removed)

---

## Server Changes

### `POST /api/projects/:id/extract-subfolder`

**Body:** `{ subfolderPath: string }`

1. Resolve source project via `projectLookup` middleware
2. Validate: `subfolderPath` non-empty; resolved absolute path passes `isPathWithinRoot(resolved, project.path)`
3. Confirm the resolved path exists and is a directory (`fs.stat`)
4. Generate new project: `id = uuidv4()`, `name = folderName`, `path = ~/.ezmdv/uploads/<safeName>/` where `safeName` is derived from `folderName` (same sanitisation as existing upload creation). If `safeName` already exists on disk as a directory, append `_<id.slice(0,6)>` to produce a unique path before proceeding.
5. Reuse (or hoist to a shared helper) the `copyDirRecursive` function already inline in the `merge-project` handler — it respects `IGNORED_DIRS` and validates each entry with `isPathWithinRoot`. Use `fs.rmSync(srcDir, { recursive: true })` after the copy. Synchronous I/O is consistent with the existing route handler style. (`fs.promises.cp` would not filter `IGNORED_DIRS` and would require async handlers, so it should not be used here.)
   — sync copy-then-delete handles cross-device moves (CLI projects may live on a different mount than `~/.ezmdv/`)
6. Add new project to state; remap open tabs: tabs where `projectId === source.id && filePath.startsWith(subfolderPath + '/')` → `projectId = newId`, `filePath = filePath.slice(subfolderPath.length + 1)`. All other source project tabs remain unchanged.
7. Remap `checkboxStates`: keys are in the format `projectId:filePath`. For matching entries (key starts with `source.id + ':' + subfolderPath + '/'`), replace outer key with `newId:strippedFilePath`. Only the outer key changes; the inner `Record<string, boolean>` is copied as-is. All other entries are unchanged.
8. Persist state; return `{ project: newProject }`

### `POST /api/projects/:destId/merge-subfolder`

**Body:** `{ sourceProjectId: string; subfolderPath: string }`

1. Resolve dest project via `projectLookup`; look up source project from state
2. Validate `subfolderPath` via `isPathWithinRoot(resolved, source.path)`
3. Derive `folderName`; check `path.join(dest.path, folderName)` does not already exist — return 409 if collision
4. Use `copyDirRecursive` (hoisted shared helper, same as `extract-subfolder`) to copy `srcDir` into `destSubdir`; then `fs.rmSync(srcDir, { recursive: true })`
5. Remap open tabs: source project + `subfolderPath/file` → dest project + `folderName/file`. All other source project tabs remain unchanged.
6. Remap `checkboxStates` outer keys with the same pattern: `source.id:subfolderPath/file` → `dest.id:folderName/file`. Inner values unchanged.
7. Persist state; return `{ merged: true, subfolderName: folderName }`
   — the source project remains in state unchanged; its file tree refreshes from disk on the next client fetch

Both endpoints use `isPathWithinRoot` for all resolved paths before any filesystem operation.

---

## Error Handling

| Scenario | Server response | Client behavior |
|---|---|---|
| `subfolderPath` outside project root | 403 | `alert()` |
| Path does not exist or is not a directory | 400 | `alert()` |
| Destination subfolder name collision | 409 | `alert()` |
| Filesystem error (permissions, etc.) | 500 | `alert()` |

---

## Testing

**Server (`routes/projects.test.ts`):**
- Extract subfolder: success — files moved to new upload project, new project in state, tabs remapped, source no longer contains folder
- Extract subfolder: path traversal rejected (403/404)
- Extract subfolder: non-directory path rejected (400)
- Merge subfolder: success — files moved to dest project, source folder removed, tabs remapped
- Merge subfolder: collision rejected (409)

**Web:**
- No new test files required. The extraction drop zone visibility is driven by `isFolderDragging` state and can be verified in existing Sidebar tests if desired.
