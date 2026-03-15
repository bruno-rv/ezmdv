# CLAUDE.md — ezmdv

## Project

Easy Markdown Viewer — a browser-based markdown viewer/editor launched from the CLI. Monorepo with three packages:

- **`packages/cli`** — CLI entry point (`ezmdv <path>`), uses Commander
- **`packages/server`** — Express 5 REST API + WebSocket for live reload, file-based state (`~/.ezmdv/state.json`)
- **`packages/web`** — React 19 SPA with Vite, Tailwind CSS 4, CodeMirror 6 editor

## Commands

```bash
npm run build              # Build all workspaces
npm run dev:server         # Build + run server (from root)
npm run dev:web            # Vite dev server with API proxy to :3000

# Per-package (run from package dir)
npm run build              # tsc (server/cli) or tsc -b && vite build (web)
```

There are no tests — all test infrastructure was intentionally removed.

## Architecture

- **State**: File-based JSON at `~/.ezmdv/state.json` — persisted projects, `openTabs`, theme, checkbox states. Split view, focused pane, fullscreen, and sidebar collapse are client-side only
- **Uploads**: Stored in `~/.ezmdv/uploads/<project>/`
- **Trash**: Deleted upload projects are moved to `~/.ezmdv/trash/<id>/` (with `meta.json` + `files/`). Purged automatically after 30 days on server startup
- **WebSocket**: Chokidar watches project dirs, broadcasts `file-changed` events
- **CORS**: Restricted to localhost origins only
- **API routes**: `/api/projects` (CRUD + rename + file read/write + upload), `/api/state` (GET/PATCH)
- **File tree filtering**: `IGNORED_DIRS` set excludes `node_modules`, `.git`, `dist`, etc. from the file tree

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

- **Hooks**: `useProjects`, `useTabs`, `useTheme`, `useWebSocket` — each owns one domain. `useTabs` manages the pane-aware workspace state (`primaryTab`, optional `secondaryTab`, focused pane, split view, fullscreen)
- **API client** (`packages/web/src/lib/api.ts`): typed fetch wrapper, all endpoints centralized
- **Lazy loading**: `MarkdownEditor` (CodeMirror) is `React.lazy()` loaded — don't eagerly import it
- **Edit mode**: Editing is single-pane only. WebSocket content refresh is suppressed while editing (via `editModeRef`)
- **Security**: All file read/write endpoints validate path traversal. Upload deletion guarded to `~/.ezmdv/uploads/` only
- **File uploads**: Always use `File[]` (not `FileList`) — `FileList` is a live DOM object that empties when `input.value` is reset. Convert with `Array.from()` before any async work
- **Folder uploads**: `webkitRelativePath` includes the root folder as a prefix (e.g., `docs/file.md`). The first segment is stripped before sending to the server; the folder name becomes the project name
- **Workspace shell**: Desktop sidebar can collapse to an icon rail. Markdown reading supports side-by-side split view and app-level fullscreen per pane
- **Multi-select**: Sidebar supports checkbox selection mode for bulk delete/open of projects
- **Keyboard shortcuts**: `Ctrl/Cmd+S` save, `Ctrl/Cmd+E` toggle edit in single-pane mode, `Ctrl/Cmd+W` close the focused tab, `Ctrl/Cmd+[/]` switch tabs, `Esc` exits fullscreen
