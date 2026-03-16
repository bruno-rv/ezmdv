# CLAUDE.md — ezmdv

## Project

Easy Markdown Viewer — a browser-based markdown viewer/editor launched from the CLI. Monorepo with three packages:

- **`packages/cli`** — CLI entry point (`ezmdv <path>`), uses Commander
- **`packages/server`** — Express 5 REST API + WebSocket for live reload, file-based state (`~/.ezmdv/state.json`)
- **`packages/web`** — React 19 SPA with Vite, Tailwind CSS 4, CodeMirror 6 editor

## Commands

```bash
npm run build              # Build all workspaces
npm test                   # Run targeted automated tests across workspaces
npm run dev:server         # Build + run server (from root)
npm run dev:web            # Vite dev server with API proxy to :3000

# Per-package (run from package dir)
npm run build              # tsc (server/cli) or tsc -b && vite build (web)
npm test                   # vitest run (server/web)
```

## After Every Code Change

**Always run `npm run build` from the repo root before testing in the browser.**

The CLI (`ezmdv <path>`) serves `packages/web/dist/` — the compiled output. Editing source files has no effect until the web package is rebuilt. Restarting the CLI without rebuilding will still serve the old bundle.

For rapid iteration, use the dev workflow instead:
- Terminal 1: `npm run dev:server` (Express API on :3000)
- Terminal 2: `npm run dev:web` (Vite dev server with HMR, proxies API to :3000)
- Open `http://localhost:5173` — changes hot-reload instantly, no manual build needed

Tests use Vitest (80 tests across 12 files):

- **Server** (42 tests, 5 files): state read/write/update (`state.test.ts`), path traversal security (`security.test.ts`), markdown graph/search utilities (`markdown.test.ts`), filesystem scanning (`filesystem.test.ts`), API route smoke tests with supertest (`routes/projects.test.ts`) including global search and dismissed CLI paths
- **Web** (38 tests, 7 files): wiki-link parsing/rendering, pane workspace, edit mode hook (`useEditMode.test.ts`), autoscroll hook (`useAutoScroll.test.ts`), graph filtering (`graphFilter.test.ts`), wiki-link autocomplete (`wikiLinkCompletion.test.ts`)

## Architecture

- **State**: File-based JSON at `~/.ezmdv/state.json` — persisted projects, `openTabs`, theme, checkbox states, `dismissedCliPaths`. Split view, focused pane, fullscreen, and sidebar collapse are client-side only
- **Uploads**: Stored in `~/.ezmdv/uploads/<project>/`
- **Trash**: Deleted upload projects are moved to `~/.ezmdv/trash/<id>/` (with `meta.json` + `files/`). Purged automatically after 30 days on server startup
- **WebSocket**: Chokidar watches project dirs, broadcasts `file-changed` events
- **CORS**: Restricted to localhost origins only
- **API routes**: `/api/projects` (CRUD + rename + file read/write + upload + graph + per-project search + global search), `/api/state` (GET/PATCH)
- **Shared constants**: `IGNORED_DIRS` in `packages/server/src/constants.ts` — single source of truth used by both route handlers and markdown scanner
- **Security module**: `packages/server/src/security.ts` — `isPathWithinRoot()` for path traversal validation, `projectLookup()` Express middleware for DRY project resolution across routes

## Code Conventions

- TypeScript strict mode, ES2022 target, ES modules throughout
- Web uses path alias `@/*` → `./src/*`
- Server/CLI use NodeNext module resolution
- React components: named exports, functional components with hooks
- Tailwind for styling — no CSS modules. Uses `cn()` utility (clsx + tailwind-merge)
- Icons from `lucide-react`
- No linter or formatter configured — follow existing code style
- No comments unless logic is non-obvious. No docstrings on components/hooks
- Prefer `useCallback` for handler functions passed as props

## Key Patterns

- **Hooks**: `useProjects`, `useTabs`, `useTheme`, `useWebSocket`, `useEditMode`, `useKeyboardShortcuts`, `useAutoScroll` — each owns one domain. `useTabs` manages the pane-aware workspace state (`primaryTab`, optional `secondaryTab`, focused pane, split view, fullscreen). `useEditMode` owns edit state/save logic. `useKeyboardShortcuts` centralizes all keyboard shortcuts. `useAutoScroll` owns teleprompter-style autoscroll with `requestAnimationFrame`
- **API client** (`packages/web/src/lib/api.ts`): typed fetch wrapper, all endpoints centralized
- **Lazy loading**: `MarkdownEditor` (CodeMirror) is `React.lazy()` loaded — don't eagerly import it
- **Edit mode**: Editing is single-pane only. WebSocket content refresh is suppressed while editing (via `editModeRef`). `handleSave(exitAfter?)` unifies save and save-and-exit into one function
- **Wiki-links**: Obsidian-style `[[Note]]` / `[[Note#Heading]]` links are supported in markdown rendering and the project graph, alongside existing relative `.md` links
- **Graph/search**: The server scans markdown files per project to build a graph view and content-search results; the web shows a dedicated project graph panel and per-project live sidebar search. Graph panel uses a force-directed layout (140 iterations), supports drag-to-reposition nodes, single-click node selection with neighbor highlighting (dims unrelated nodes/edges), and double-click to open the file. Graph button in the sidebar uses the `Waypoints` icon. Hovering a node for 5s opens a full-screen preview modal (close via X button, backdrop click, or Escape key)
- **Security**: Path traversal validated via shared `isPathWithinRoot()` in `security.ts`. Upload deletion guarded to `~/.ezmdv/uploads/` only. Express 5 normalizes `../` in URLs before route handlers — path traversal tests accept both 403 and 404
- **File uploads**: Always use `File[]` (not `FileList`) — `FileList` is a live DOM object that empties when `input.value` is reset. Convert with `Array.from()` before any async work
- **Folder uploads**: `webkitRelativePath` includes the root folder as a prefix (e.g., `docs/file.md`). The first segment is stripped before sending to the server; the folder name becomes the project name
- **Workspace shell**: Desktop sidebar can collapse to an icon rail. Markdown reading supports side-by-side split view, pane swapping, a project graph panel, and app-level fullscreen per pane
- **Multi-select**: Sidebar supports checkbox selection mode for bulk delete/open of projects
- **Autoscroll**: `useAutoScroll` hook with discrete-step `requestAnimationFrame` loop — two-phase model (wait interval → animate 300ms with ease-out cubic). First step fires immediately on activation. Configurable `intervalSeconds` (1–30) and `scrollPercent` (1–100%). `AutoScrollControls` component: play/pause button + settings popover with range sliders. Auto-stops at bottom, on edit/split/graph mode, and on tab switch. Pauses 2s on user wheel/touch, then resumes. View-mode only, single pane only
- **Dismissed CLI paths**: When a CLI-sourced project is deleted from the sidebar, its path is added to `state.dismissedCliPaths`. The CLI checks this list before registering a project, preventing re-addition on restart
- **Global search**: `GET /api/projects/search?q=` searches across all projects. `GlobalSearch` component in sidebar with debounced input (250ms), dropdown results showing project name, file name, match count, and preview. Preserves existing per-project search in `ExpandedProjectContent`
- **Keyboard shortcuts**: `Ctrl/Cmd+S` save, `Ctrl/Cmd+E` toggle edit in single-pane mode, `Ctrl/Cmd+Shift+A` toggle autoscroll, `Ctrl/Cmd+W` close the focused tab, `Ctrl/Cmd+[/]` switch tabs, `Esc` exits fullscreen
- **Wiki-link autocomplete**: `@codemirror/autocomplete` installed; `wikiLinkSource()` in `packages/web/src/lib/wikiLinkCompletion.ts` — pure `CompletionSource` factory triggered on `[[`; `filePaths` prop on `MarkdownEditor`, populated via `getProjectFilePaths` effect in App.tsx when `editMode` is true
- **Shortcuts modal**: `ShortcutsModal.tsx` at `packages/web/src/components/ShortcutsModal.tsx`; `onShowShortcuts` prop on Sidebar; `showShortcuts` state in App.tsx; `Keyboard` lucide icon in sidebar header
- **Graph search**: `searchProjectContent` API + `filterGraphBySearch()` in `packages/web/src/lib/graphFilter.ts` (pure); debounced 200ms in GraphPanel.tsx; `filteredGraph` useMemo replaces `graph` in all rendering; node count display `X / Y nodes`. Drag uses direct DOM manipulation during mousemove and commits to React state only on mouseup
- **Extracted components**: `FileTreeNode` (recursive file tree), `ExpandedProjectContent` (project search + file list), `GraphPreviewModal` (graph overlay) — extracted from App.tsx and Sidebar.tsx to reduce file size
- **File metadata tooltip**: `GET /api/projects/:id/file-meta?path=` server endpoint; `fetchFileMetadata` in `packages/web/src/lib/api.ts`; `FileMetaTooltip.tsx` component; lazy-fetched with `Map` cache in App.tsx on `Info` button hover
