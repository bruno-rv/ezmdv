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
- **Extraction drop zone** below the project list — folder becomes a new standalone upload project (files moved to `~/.ezmdv/uploads/<newId>/`)

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
- Two new props: `onFolderDragStart?: () => void` and `onFolderDragEnd?: () => void` — called on the outermost folder element's drag events and bubbled up the component tree

### `ExpandedProjectContent.tsx`

- Accepts and forwards `onFolderDragStart` / `onFolderDragEnd` props down to `FileTreeNode`

### `Sidebar.tsx`

- Tracks `isFolderDragging: boolean` state, toggled by the forwarded callbacks
- **Project headers**: `onDragOver` and `onDrop` extend to handle `application/x-ezmdv-folder` alongside the existing `application/x-ezmdv-project` type. On folder drop, calls `onMergeSubfolder(destProjectId, sourceProjectId, folderPath)`
- **Extraction drop zone**: A `div` rendered below the project list. Hidden when `!isFolderDragging`. When visible: dashed border, muted label "Drop to create new project". Uses counter-based `dragenter`/`dragleave` (same pattern as the app-level upload drop zone) to avoid flicker on child elements. On drop, calls `onExtractSubfolder(sourceProjectId, folderPath)`
- New props: `onMergeSubfolder`, `onExtractSubfolder`, `onFolderDragStart`, `onFolderDragEnd`

### `App.tsx`

- `handleMergeProject`: remove `window.confirm()`, merge fires immediately
- `handleMergeSubfolder(destProjectId, sourceProjectId, folderPath)`: calls `mergeSubfolder`, reloads dest project files on success
- `handleExtractSubfolder(sourceProjectId, folderPath)`: calls `extractSubfolder`, adds returned project to list
- Wire new handlers as props to `Sidebar`

### `api.ts`

```ts
export async function extractSubfolder(
  projectId: string,
  subfolderPath: string,
): Promise<{ project: Project }>

export async function mergeSubfolderInto(
  destProjectId: string,
  sourceProjectId: string,
  subfolderPath: string,
): Promise<{ merged: boolean; subfolderName: string }>
```

### `useProjects.ts`

- `extractSubfolder(projectId, subfolderPath)` — calls API, appends new project to state, reloads source project files
- `mergeSubfolder(destProjectId, sourceProjectId, subfolderPath)` — calls API, reloads dest project files

---

## Server Changes

### `POST /api/projects/:id/extract-subfolder`

**Body:** `{ subfolderPath: string }`

1. Resolve source project via `projectLookup` middleware
2. Validate `subfolderPath` is non-empty, contains no `..`, and resolves within `project.root` via `isPathWithinRoot`
3. Confirm the path exists and is a directory
4. Generate new project: `id = nanoid()`, `name = folderName`, `root = ~/.ezmdv/uploads/<id>/`
5. `fs.cp` (recursive) from `sourceRoot/subfolderPath/` to new root; then `fs.rm` the source subfolder (recursive)
   - Use copy-then-delete rather than `fs.rename` to handle cross-device moves (uploads may be on a different mount than CLI project roots)
6. Add new project to state; remap open tabs: tabs where `projectId === source.id && filePath.startsWith(subfolderPath + '/')` become `projectId = newId`, `filePath = filePath.slice(subfolderPath.length + 1)`
7. Remap `checkboxStates` keys with the same prefix logic
8. Persist state; return `{ project: newProject }`

### `POST /api/projects/:destId/merge-subfolder`

**Body:** `{ sourceProjectId: string; subfolderPath: string }`

1. Resolve dest project via `projectLookup`; look up source project from state
2. Validate `subfolderPath` within source root
3. Derive `folderName`; check `destRoot/folderName/` does not already exist (return 409 if collision)
4. `fs.cp` (recursive) from `sourceRoot/subfolderPath/` to `destRoot/folderName/`; then `fs.rm` source subfolder
5. Remap open tabs: source project + `subfolderPath/file` → dest project + `folderName/file`
6. Remap `checkboxStates` similarly
7. Persist state; return `{ merged: true; subfolderName: folderName }`

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
- Extract subfolder: success (files moved, new project in state, tabs remapped)
- Extract subfolder: path traversal rejected (403/404)
- Extract subfolder: non-directory path rejected (400)
- Merge subfolder: success (files moved to dest, tabs remapped)
- Merge subfolder: collision rejected (409)

**Web:**
- No new test files needed; existing drag tests cover the MIME type pattern. The extraction drop zone visibility is driven by `isFolderDragging` state — straightforward to verify in `Sidebar` tests if desired.
