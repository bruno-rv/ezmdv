# ezmdv

Easy Markdown Viewer is a browser-based markdown viewer/editor launched from the CLI.

It is a monorepo with three packages:

- `packages/cli`: CLI entry point
- `packages/server`: Express API + WebSocket server
- `packages/web`: React SPA

## Features

- Open a markdown project from the CLI
- Browse markdown files in a sidebar tree
- Preview rendered markdown with code highlighting, Mermaid, footnotes, and collapsible sections
- Edit markdown in-app and save changes
- Open two markdown files side by side for reading
- Fullscreen a markdown pane
- Upload markdown files or folders into local app storage

## Requirements

- A recent version of Node.js
- npm

## Clone And Install

```bash
git clone https://github.com/bruno-rv/ezmdv.git
cd ezmdv
npm install
```

## Build

Build all workspaces:

```bash
npm run build
```

## Run Locally

### Option 1: Run the built CLI directly

Build first, then point the CLI to a markdown file or directory:

```bash
npm run build
node packages/cli/dist/index.js /path/to/markdown-or-folder
```

You can also choose a fixed port or skip auto-opening the browser:

```bash
node packages/cli/dist/index.js /path/to/docs --port 3000 --no-open
```

### Option 2: Link the CLI locally

If you want the `ezmdv` command available on your machine during development:

```bash
npm run build
npm link ./packages/cli
ezmdv /path/to/markdown-or-folder
```

## Development

Run the backend and frontend in separate terminals.

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:web
```

The Vite app runs with API and WebSocket proxying to the local server on port `3000`.

## Local Data

ezmdv stores local application data under `~/.ezmdv/`:

- `state.json`: persisted projects, theme, open tabs, and checkbox state
- `uploads/`: uploaded markdown projects
- `trash/`: deleted uploaded projects retained temporarily before purge

## Notes

- Uploaded files stay on your machine.
- The server only allows localhost origins.
- There is currently no automated test suite in the repo.
