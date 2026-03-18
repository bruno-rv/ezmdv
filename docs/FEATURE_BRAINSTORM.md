# Feature Brainstorm — ezmdv

Six high-value features to enhance the markdown viewer/editor experience.

---

## 1. Command Palette

**What**: A `Ctrl+K` / `Cmd+K` quick-action launcher overlay — type to fuzzy-find files across all projects, switch tabs, toggle theme, run actions.

**Why**: Power users expect this pattern (VS Code, Obsidian, Notion). It dramatically reduces the time to navigate between files, especially with many projects/files open. Currently users must visually scan the sidebar or use global search — a command palette is faster for known targets.

**Implementation**:

- **New component**: `CommandPalette.tsx` — modal overlay with text input and filtered result list
- **Keybinding**: Register `Ctrl/Cmd+K` in `useKeyboardShortcuts`. Add to `ShortcutsModal` display
- **Data sources** (in priority order):
  1. **Open tabs** — switch to an already-open tab instantly
  2. **All files** — fuzzy search across all project file trees (reuse `GET /api/projects/:id/files` data already cached in `useProjects`)
  3. **Actions** — toggle theme, toggle edit mode, toggle split view, open graph, etc.
- **Fuzzy matching**: Reuse the client-side portion of fuzzy logic, or implement a lightweight scorer (filename match > path match > substring). Highlight matched characters in results
- **Keyboard navigation**: Arrow keys to move selection, Enter to execute, Escape to dismiss
- **Result format**: Icon (file/action) + filename + project name (muted) + path breadcrumb
- **Scope**: Prefix commands — `>` for actions, `#` for heading search within current file, default for file search (similar to VS Code)

**Files to modify**:
- `packages/web/src/components/CommandPalette.tsx` (new)
- `packages/web/src/components/App.tsx` — mount palette, pass projects/tabs/actions
- `packages/web/src/hooks/useKeyboardShortcuts.ts` — register `Ctrl+K`
- `packages/web/src/components/ShortcutsModal.tsx` — add to displayed shortcuts

**Estimated scope**: Medium — mostly client-side, no new API endpoints needed.

---

## 2. Table of Contents Panel

**What**: An auto-generated, clickable outline of headings from the current document, displayed as a toggleable side panel or sidebar section.

**Why**: Long markdown documents are hard to navigate. A TOC gives users instant orientation ("where am I?") and one-click jump-to-section. This is one of the most requested features in any markdown tool.

**Implementation**:

- **Heading extraction**: Parse the rendered markdown for `h1`–`h6` elements. Two approaches:
  - **Client-side (preferred)**: After `MarkdownView` renders, query `querySelectorAll('h1, h2, h3, h4, h5, h6')` from the prose container. Extract text content and generate slug IDs (matching `react-markdown`'s heading ID generation). This avoids duplicating parsing logic
  - **Alternative**: Parse raw markdown with a regex or remark plugin server-side — more robust but adds API complexity
- **New component**: `TableOfContents.tsx` — nested list of heading links with indentation by level
- **Scroll sync**: Highlight the current heading in the TOC as the user scrolls the document. Use `IntersectionObserver` on heading elements
- **Toggle button**: Add a `List` (lucide) icon to the pane toolbar (view mode only), next to the existing zoom/refresh controls
- **Placement options**:
  - **Option A**: Right-side panel within the pane (alongside content, narrower)
  - **Option B**: Sidebar section below the file tree (always accessible)
  - **Option A is recommended** — keeps it contextual to the active pane and doesn't clutter the sidebar
- **Split view**: Each pane gets its own TOC state independently
- **Edit mode**: TOC could remain visible (from last render) or hide — hiding is simpler and avoids stale data

**Files to modify**:
- `packages/web/src/components/TableOfContents.tsx` (new)
- `packages/web/src/components/MarkdownView.tsx` — extract headings after render, pass to TOC
- `packages/web/src/components/App.tsx` — TOC toggle state per pane

**Estimated scope**: Small-medium — purely client-side, no API changes.

---

## 3. Backlinks Panel

**What**: A panel showing all files that link TO the current file — the inverse of outgoing links already shown in the graph.

**Why**: Backlinks are a core feature of tools like Obsidian and Roam. They turn a collection of markdown files into a connected knowledge base. Users can discover unexpected connections and navigate bidirectionally. The graph already computes this data — backlinks surface it in a more actionable way.

**Implementation**:

- **Server-side**: The `POST /api/projects/:id/graph` endpoint already builds a full node/edge graph. Add a new endpoint `GET /api/projects/:id/backlinks?path=<filePath>` that:
  1. Builds the graph (or caches it — see optimization below)
  2. Filters edges where `target === filePath`
  3. Returns `{ backlinks: [{ sourceFile, linkText, lineNumber, context }] }` — include a snippet of surrounding text for each link
- **Caching**: Graph building scans every file. Cache the graph per project with invalidation on `file-changed` WebSocket events. This also speeds up repeated graph panel opens
- **New component**: `BacklinksPanel.tsx` — list of backlink entries, each showing:
  - Source filename (clickable — opens in tab)
  - Line preview with the link highlighted
  - Link count badge
- **Placement**: Below the TOC in the right-side panel, or as a separate toggle. A combined "Document Info" panel (TOC + backlinks + metadata) could work well
- **Wiki-link awareness**: Must resolve both `[[Note]]` wiki-links and relative `[text](./note.md)` links — the graph already handles both

**Files to modify**:
- `packages/server/src/routes/projects.ts` — new `GET /:id/backlinks` route
- `packages/server/src/markdown.ts` — extract backlink data with context snippets
- `packages/web/src/lib/api.ts` — add `getBacklinks()` typed client
- `packages/web/src/components/BacklinksPanel.tsx` (new)
- `packages/web/src/components/App.tsx` — mount panel, fetch on tab change

**Estimated scope**: Medium — new API endpoint + client component, but leverages existing graph logic.

---

## 4. Find & Replace (In-Editor)

**What**: Search and replace within the current document while in edit mode.

**Why**: Currently there's no way to find text within the editor. For any non-trivial editing (renaming a term, fixing repeated typos), users have to manually scan. CodeMirror 6 has a built-in search extension — this is low-hanging fruit.

**Implementation**:

- **CodeMirror extension**: Import `@codemirror/search` and add it to the editor's extensions array. This provides:
  - `Ctrl/Cmd+F` — open search panel
  - `Ctrl/Cmd+H` — open search + replace panel
  - Match highlighting, case sensitivity toggle, regex toggle
  - Find next/previous navigation
- **Styling**: The default CodeMirror search panel needs Tailwind-compatible styling to match the app's theme. Override the CSS for `.cm-search`, `.cm-searchMatch`, etc. in the theme configuration
- **Theme integration**: Ensure search panel colors respect light/dark theme
- **Keyboard shortcut conflict**: `Ctrl+F` doesn't currently conflict with anything. `Ctrl+H` is unused. No conflicts expected

**Files to modify**:
- `packages/web/src/components/MarkdownEditor.tsx` — add `@codemirror/search` to extensions
- `packages/web/package.json` — add `@codemirror/search` dependency (may already be available as a transitive dep of `@uiw/react-codemirror`)

**Estimated scope**: Small — mostly configuration, the heavy lifting is done by CodeMirror.

---

## 5. Markdown Templates

**What**: When creating a new file, offer a template picker with common starting points (blank, meeting notes, README, journal entry, project plan, etc.).

**Why**: Blank files are intimidating and repetitive to scaffold. Templates reduce friction for common workflows and help users establish consistent structure across their notes.

**Implementation**:

- **Template definitions**: A `templates.ts` file with an array of `{ id, name, icon, content }` objects. Start with 5–8 built-in templates:
  - **Blank** (default, empty file)
  - **Meeting Notes** — date, attendees, agenda, action items sections
  - **README** — title, description, installation, usage, license
  - **Journal Entry** — date header, gratitude, tasks, reflections
  - **Project Plan** — overview, goals, milestones, tasks checklist
  - **Bug Report** — description, steps to reproduce, expected/actual
  - **Weekly Review** — accomplishments, blockers, next week
- **UI flow**: When user clicks `FilePlus`:
  1. Current behavior: inline input for filename → creates empty file
  2. New behavior: inline input for filename → small dropdown/popover showing templates → selecting one creates the file with template content pre-filled
  3. Default selection is "Blank" so existing workflow is unchanged (Enter on filename still creates empty file)
- **Template variables**: Simple substitution — `{{date}}` → today's date, `{{filename}}` → the file name. Keep it minimal, no complex templating engine
- **Custom templates** (future): Allow users to save their own templates in `~/.ezmdv/templates/`. Out of scope for v1 but design the template array to be extensible
- **Server-side**: The existing `POST /api/projects/:id/create-file` accepts content — just pass the template body. No API changes needed

**Files to modify**:
- `packages/web/src/lib/templates.ts` (new) — template definitions
- `packages/web/src/components/ExpandedProjectContent.tsx` — template picker UI on file creation
- `packages/web/src/components/FileTreeNode.tsx` — same for subfolder file creation

**Estimated scope**: Small — all client-side, no API changes. Template content is static.

---

## 6. Image Paste & Embed

**What**: Paste images from clipboard directly into the editor (Ctrl+V with image data). Images are uploaded and an `![](url)` reference is inserted at the cursor.

**Why**: Markdown's biggest friction point is images. Currently users must manually save an image file, upload it separately, and type the reference. Paste-to-embed is expected in modern editors (GitHub, Notion, Obsidian) and removes a major workflow interruption.

**Implementation**:

- **Clipboard handling**: In `MarkdownEditor.tsx`, add a `paste` event handler on the CodeMirror editor:
  1. Check `event.clipboardData.items` for `image/*` types
  2. Extract the `Blob` from the clipboard item
  3. Generate a filename: `paste-{timestamp}.png`
  4. Upload via the existing `POST /api/projects/:id/upload` endpoint (it already handles file uploads via multer)
  5. On success, insert `![image](uploaded-file-path)` at the cursor position using CodeMirror's `dispatch` API
- **Upload destination**: Use the existing upload infrastructure — images go to `~/.ezmdv/uploads/<project>/`
- **Progress indicator**: Show a placeholder `![Uploading...](...)` while the upload is in progress, then replace with the real URL
- **Drag-and-drop images**: Extend the same logic to handle image files dropped onto the editor (not just clipboard paste)
- **Serving images**: Need a new route `GET /api/projects/:id/uploads/*` to serve uploaded images, or reference them via a path that the existing file-serving route handles
- **Accepted formats**: PNG, JPEG, GIF, WebP, SVG
- **File size limit**: Add a reasonable limit (e.g., 10MB) with user feedback on rejection
- **Markdown rendering**: `MarkdownView` already renders `![](url)` — just need to ensure the image URL resolves correctly. May need to transform relative paths in the rendered output

**Files to modify**:
- `packages/web/src/components/MarkdownEditor.tsx` — paste/drop event handlers, upload logic
- `packages/server/src/routes/projects.ts` — image serving route (if not already covered), possibly accept non-`.md` uploads
- `packages/web/src/lib/api.ts` — add `uploadImage()` if the existing upload function needs adjustment
- `packages/web/src/components/MarkdownView.tsx` — resolve image URLs relative to the project

**Estimated scope**: Medium — involves both client and server changes, file serving, and editor integration.

---

## Implementation Priority

Recommended order based on effort vs. impact:

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Find & Replace | Small | High — unblocks basic editing workflows |
| 2 | Command Palette | Medium | High — transforms navigation speed |
| 3 | Table of Contents | Small-Med | High — essential for long docs |
| 4 | Markdown Templates | Small | Medium — reduces friction for new files |
| 5 | Backlinks Panel | Medium | High — unlocks knowledge-base use case |
| 6 | Image Paste & Embed | Medium | High — removes biggest editing friction |

Find & Replace first because it's nearly zero effort (CodeMirror built-in) with immediate payoff. Command Palette next because it's the single biggest UX upgrade. Then TOC and Templates for quick wins. Backlinks and Image Paste are meatier but transform the tool from a viewer into a true knowledge management app.
