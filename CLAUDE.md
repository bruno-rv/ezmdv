# CLAUDE.md — ezmdv

## Project

Easy Markdown Viewer — a browser-based markdown viewer/editor launched from the CLI. Monorepo with three packages:

- **`packages/cli`** — CLI entry point (`ezmdv <path>`), uses Commander
- **`packages/server`** — Express 5 REST API + WebSocket for live reload, file-based state (`~/.ezmdv/state.json`)
- **`packages/web`** — React 19 SPA with Vite, Tailwind CSS 4, CodeMirror 6 editor

## Commands

```bash
npm start           # Build all + launch browser
npm run build       # Build all (server first, then cli + web in parallel)
npm test            # Run all tests across workspaces
npm run dev:server  # Build + run server on :3000
npm run dev:web     # Vite dev server with HMR, proxies API to :3000 → open :5173
```

## After Every Code Change

**Always run `npm run build` from root before testing in the browser.** The CLI serves `packages/web/dist/` — source edits have no effect until rebuilt.

For rapid iteration use the dev workflow: `dev:server` + `dev:web` in two terminals.

Tests use Vitest (server + web packages). Server tests cover state, security, markdown graph/search, filesystem, API routes, subfolder extract/merge, fuzzy search, zoom level persistence, and backlinks. Web tests cover wiki-links, pane workspace, hooks (edit mode, autoscroll), graph filtering/zoom, wiki-link autocomplete, search toolbar layout, command palette, backlinks panel, table of contents, and templates.

## Architecture

- **State**: File-based JSON at `~/.ezmdv/state.json` — projects, `openTabs`, theme, checkbox states, `dismissedCliPaths`, `keyboardShortcuts`, `zoomLevels`. Split view, focused pane, fullscreen, and sidebar collapse are client-side only
- **Uploads**: Stored in `~/.ezmdv/uploads/<project>/`
- **Trash**: Deleted upload projects moved to `~/.ezmdv/trash/<id>/` (`meta.json` + `files/`). Purged after 30 days on server startup
- **WebSocket**: Chokidar watches project dirs, broadcasts `file-changed` events
- **CORS**: Restricted to localhost origins only
- **API routes**: `/api/projects` (CRUD + rename + file read/write + create-file + create-folder + merge-project + extract-subfolder + merge-subfolder + upload + upload-image + images + backlinks + graph + per-project search + global search), `/api/state` (GET/PATCH)
- **Shared constants**: `IGNORED_DIRS` in `packages/server/src/constants.ts`
- **Security module**: `packages/server/src/security.ts` — `isPathWithinRoot()` for path traversal, `projectLookup()` Express middleware for DRY project resolution

## Code Conventions

- TypeScript strict mode, ES2022 target, ES modules throughout
- Web uses path alias `@/*` → `./src/*`; Server/CLI use NodeNext module resolution
- React components: named exports, functional components with hooks
- Tailwind for styling — no CSS modules. Uses `cn()` utility (clsx + tailwind-merge)
- Icons from `lucide-react`
- No linter/formatter — follow existing code style
- No comments unless logic is non-obvious. No docstrings on components/hooks
- Prefer `useCallback` for handler functions passed as props

## Key Patterns

- **Hooks**: `useProjects`, `useTabs`, `useTheme`, `useWebSocket`, `useEditMode`, `useKeyboardShortcuts`, `useAutoScroll` — each owns one domain. `useTabs` manages pane-aware workspace (`primaryTab`, optional `secondaryTab`, focused pane, split view, fullscreen). `useEditMode` owns edit state/save logic. `useAutoScroll` owns teleprompter-style autoscroll with `requestAnimationFrame`
- **API client** (`packages/web/src/lib/api.ts`): typed fetch wrapper, all endpoints centralized
- **Lazy loading**: `MarkdownEditor` (CodeMirror) is `React.lazy()` — don't eagerly import it
- **Edit mode**: Single-pane only. WebSocket content refresh suppressed while editing (via `editModeRef`). `handleSave(exitAfter?)` unifies save and save-and-exit
- **Wiki-links**: Obsidian-style `[[Note]]` / `[[Note#Heading]]` supported in rendering and graph, alongside relative `.md` links
- **Graph**: Force-directed layout (140 iterations). Single-click selects node with neighbor highlighting; double-click opens file. Hover 5s for `NodePreview` modal (minimize/maximize/restore + per-file zoom controls). Double-click node opens `GraphPreviewModal` (also has per-file zoom). Zoom/pan via scroll wheel, keyboard (`+`/`=`/`-`/`0`), and buttons. Zoom utilities in `packages/web/src/lib/graphZoom.ts`. Graph button uses `Waypoints` icon. Drag uses direct DOM manipulation during mousemove, commits to React state on mouseup
- **Graph search**: `filterGraphBySearch()` in `packages/web/src/lib/graphFilter.ts` (pure); debounced 200ms in GraphPanel.tsx; node count display `X / Y nodes`
- **Security**: Path traversal via `isPathWithinRoot()`. Upload deletion guarded to `~/.ezmdv/uploads/` only. Express 5 normalizes `../` in URLs — path traversal tests accept both 403 and 404
- **File uploads**: Multi-file picker (`accept=".md"`, `multiple`) + drag-and-drop. Always use `File[]` not `FileList` — `FileList` empties when `input.value` is reset. Convert with `Array.from()` before any async work
- **File creation**: `POST /api/projects/:id/create-file`; `FilePlus` icon in `ExpandedProjectContent`; auto-appends `.md`; creates parent dirs; opens new file in tab
- **Folder creation**: `POST /api/projects/:id/create-folder`; `FolderPlus` icon in `ExpandedProjectContent`; creates dirs recursively
- **Project merging**: `POST /api/projects/:id/merge-project`; drag a project onto another in sidebar to merge as subfolder (no confirm dialog). Copies files respecting `IGNORED_DIRS`, remaps `openTabs` and `checkboxStates`
- **Subfolder drag-out**: `POST /api/projects/:id/extract-subfolder`; drag a folder node in `FileTreeNode` to the extraction drop zone below the project list to create a new upload project. `POST /api/projects/:id/merge-subfolder`; drag a folder node onto another project header to merge it there. Both use `writeState` (not `updateState`) so remapped checkbox keys fully replace old ones. `isFolderDragging` state in Sidebar controls drop zone visibility; counter-based drag enter/leave prevents flicker
- **Subfolder creation**: `FolderPlus` button appears on directory rows in `FileTreeNode` (hover-visible); opens inline input at correct depth. Inputs submit on blur. `onCreateFolder` threaded through `ExpandedProjectContent` → `FileTreeNode`
- **Workspace shell**: Sidebar collapses to icon rail. Supports split view, pane swapping, graph panel, fullscreen per pane, multi-select for bulk delete/open
- **Autoscroll**: `useAutoScroll` — two-phase RAF loop (wait → animate). Configurable interval (1–30s) and scroll percent (1–100%). `AutoScrollControls` has play/pause + settings popover. Auto-stops at bottom or on edit/split/graph/tab-switch. Pauses 2s on wheel/touch. View mode + single pane only
- **Dismissed CLI paths**: Deleted CLI-sourced projects add path to `state.dismissedCliPaths`; CLI skips these on restart
- **Global search**: `GET /api/projects/search?q=`; `GlobalSearch` component in sidebar, debounced 250ms, dropdown with project/file/count/preview
- **Fuzzy search**: `fuzzySearch.ts` — trigram + stemming + multi-signal scoring (exact > filename > stemmed tokens > trigram). Activated via `mode=fuzzy`. Toggle (`~`/`Aa`) in both search UIs
- **Refresh from disk**: `RefreshCw` in pane toolbar (view mode only); `Ctrl/Cmd+Shift+R`
- **Keyboard shortcuts**: `Ctrl/Cmd+S` save, `+E` toggle edit, `+Shift+A` autoscroll, `+Shift+R` refresh, `+Shift+T` toggle TOC, `+K` command palette, `+W` close tab, `+[/]` switch tabs, `Esc` exit fullscreen, `+`/`=`/`-`/`0` graph zoom
- **Wiki-link autocomplete**: `wikiLinkSource()` in `packages/web/src/lib/wikiLinkCompletion.ts`; triggered on `[[`; `filePaths` prop on `MarkdownEditor`, populated when `editMode` is true
- **Shortcuts modal**: `ShortcutsModal.tsx`; `Keyboard` icon in sidebar header
- **Per-file zoom**: `zoomLevels: Record<"projectId:filePath", number>` in `AppState`. `App.tsx` owns state and exposes `getZoom`/`handleZoomChange`/`handleZoomReset`. Zoom applied as `fontSize: "${zoom*100}%"` on `MarkdownView`'s prose container. Controls in pane toolbar (view mode only), `NodePreview` header, and `GraphPreviewModal` header. Default (100%) writes no entry; double-clicking `%` badge resets. Server uses plain replacement (not additive merge) for `zoomLevels` — client always sends the full map
- **Command palette**: `Ctrl/Cmd+K` opens `CommandPalette.tsx`. Fuzzy searches open tabs, all files across projects, and actions (prefix `>`). Keyboard navigation (arrows/enter/escape). `useCommandPaletteActions` hook provides action list (theme toggle, edit mode, split view, shortcuts)
- **Table of contents**: `List` icon in pane toolbar (view mode only); `Ctrl/Cmd+Shift+T`. `TableOfContents.tsx` renders clickable heading outline extracted from rendered markdown via `onHeadingsExtracted` callback. `IntersectionObserver` in `App.tsx` tracks active heading for scroll sync. 250px right-side panel
- **Backlinks panel**: `Link2` icon in pane toolbar (view mode only). `GET /api/projects/:id/backlinks?path=` returns incoming links with context snippets by leveraging the graph. `BacklinksPanel.tsx` shows source files with click-to-navigate. Shared right-side panel with TOC
- **Markdown templates**: `TemplatePicker.tsx` dropdown shown during file creation in `ExpandedProjectContent`. 8 built-in templates (blank, meeting notes, README, journal, project plan, bug report, weekly review, checklist) defined in `packages/web/src/lib/templates.ts`. `formatTemplate()` substitutes `{{date}}` and `{{filename}}` variables. Template content passed to `POST /api/projects/:id/create-file` body
- **Find & replace**: `@codemirror/search` extension with `search({ top: true })` in `MarkdownEditor.tsx`. `Ctrl/Cmd+F` find, `Ctrl/Cmd+H` find & replace (built-in CodeMirror behavior)
- **Image paste & embed**: Paste/drop image handlers in `MarkdownEditor.tsx` via `EditorView.domEventHandlers`. Clipboard images extracted from `clipboardData.items`, uploaded via `POST /api/projects/:id/upload-image` (multer, 10MB limit, stored in `<project>/images/`). Inserts `![](path)` at cursor, shows placeholder during upload. Images served via `GET /api/projects/:id/images/*`. `MarkdownView` resolves relative image URLs using `getImageUrl()`
- **Extracted components**: `FileTreeNode`, `ExpandedProjectContent`, `GraphPreviewModal`
- **File metadata tooltip**: `GET /api/projects/:id/file-meta?path=`; `FileMetaTooltip.tsx`; lazy-fetched with `Map` cache on `Info` button hover
