# Markdown Zoom Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-file font-size zoom (50–200%, 10% steps) to all markdown reading surfaces — the main pane, split view, and both graph preview modals — persisting zoom per `.md` file in `~/.ezmdv/state.json`.

**Architecture:** Zoom is stored as `zoomLevels: Record<"projectId:filePath", number>` in `AppState`. `App.tsx` owns the zoom state and exposes `getZoom`/`handleZoomChange`/`handleZoomReset` helpers that thread scalar `zoom` values and callbacks down to `MarkdownView`, `GraphPanel`, and `GraphPreviewModal`. The zoom mechanic is `fontSize: "${zoom * 100}%"` on the `markdown-body` div — all Tailwind `prose` typography scales proportionally.

**Tech Stack:** TypeScript, React 19, Tailwind CSS 4, Vitest, Express 5, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-17-markdown-zoom-design.md`

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `packages/server/src/state.ts` | Modify | Add `zoomLevels` to `AppState` + `DEFAULT_STATE`; add plain-replacement branch in `updateState` |
| `packages/server/src/state.test.ts` | Modify | Add 3 tests for `zoomLevels` default + updateState behaviour |
| `packages/web/src/lib/api.ts` | Modify | Add `zoomLevels` to client `AppState` interface |
| `packages/web/src/components/MarkdownView.tsx` | Modify | Add `zoom?: number` prop; apply `fontSize` style on `markdown-body` div |
| `packages/web/src/App.tsx` | Modify | Zoom state + helpers; extend `graphPreview` type with `projectId`; zoom controls in reading pane toolbar; pass zoom to all consumers |
| `packages/web/src/components/GraphPanel.tsx` | Modify | Add `getZoom`/`onZoomChange`/`onZoomReset` to `GraphPanelProps`; compute scalar zoom before passing to `NodePreview`; add zoom controls to `NodePreview` header |
| `packages/web/src/components/GraphPreviewModal.tsx` | Modify | Add zoom props + controls to modal header |

---

## Task 1: Server state — add `zoomLevels`

**Files:**
- Modify: `packages/server/src/state.ts`
- Modify: `packages/server/src/state.test.ts`

- [ ] **Step 1.1 — Write the three failing tests**

Add these tests to `packages/server/src/state.test.ts` — after the existing `updateState` describe block:

```ts
describe('zoomLevels', () => {
  it('includes zoomLevels in default state', () => {
    const state = readState('/nonexistent/path/state.json');
    expect(state.zoomLevels).toEqual({});
  });

  it('updateState replaces zoomLevels entirely (not additive merge)', () => {
    const statePath = makeTempStatePath();
    writeState({
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {},
      dismissedCliPaths: [],
      zoomLevels: { 'p1:a.md': 1.5, 'p1:b.md': 0.8 },
    }, statePath);

    // Sending a map with only one key should REPLACE the whole map
    const updated = updateState({ zoomLevels: { 'p1:a.md': 1.2 } }, statePath);

    expect(updated.zoomLevels).toEqual({ 'p1:a.md': 1.2 });
    expect(updated.zoomLevels!['p1:b.md']).toBeUndefined();
  });

  it('updateState with empty zoomLevels clears all zoom entries', () => {
    const statePath = makeTempStatePath();
    writeState({
      theme: 'light',
      projects: [],
      openTabs: [],
      checkboxStates: {},
      dismissedCliPaths: [],
      zoomLevels: { 'p1:a.md': 1.5 },
    }, statePath);

    const updated = updateState({ zoomLevels: {} }, statePath);

    expect(updated.zoomLevels).toEqual({});
  });
});
```

Also update the existing `'returns default state when file does not exist'` snapshot to add `zoomLevels: {}`:

```ts
expect(state).toEqual({
  theme: 'light',
  projects: [],
  openTabs: [],
  checkboxStates: {},
  dismissedCliPaths: [],
  keyboardShortcuts: {},
  zoomLevels: {},          // add this line
});
```

- [ ] **Step 1.2 — Run to verify tests fail**

```bash
cd /Users/bruno/Claude/ezmdv
npm test -w packages/server 2>&1 | grep -E 'FAIL|PASS|zoomLevels|Error'
```

Expected: failures mentioning `zoomLevels`.

- [ ] **Step 1.3 — Implement in `packages/server/src/state.ts`**

Add `zoomLevels` to the interface and default, and add the plain-replacement branch in `updateState`:

```ts
export interface AppState {
  theme: 'light' | 'dark';
  projects: Project[];
  openTabs: Tab[];
  checkboxStates: Record<string, Record<string, boolean>>;
  dismissedCliPaths: string[];
  keyboardShortcuts?: Record<string, string>;
  zoomLevels?: Record<string, number>;   // "projectId:filePath" → 0.5–2.0
}

const DEFAULT_STATE: AppState = {
  theme: 'light',
  projects: [],
  openTabs: [],
  checkboxStates: {},
  dismissedCliPaths: [],
  keyboardShortcuts: {},
  zoomLevels: {},
};
```

In `updateState`, add the branch **after** the existing `checkboxStates` block (around line 68):

```ts
  // Plain replacement — client always sends the full map
  if (partial.zoomLevels !== undefined) {
    merged.zoomLevels = partial.zoomLevels;
  }
```

- [ ] **Step 1.4 — Run tests to verify they pass**

```bash
npm test -w packages/server 2>&1 | tail -10
```

Expected: all server tests pass (3 new + all previous). The output total will be around 100. If the default-state snapshot test still fails, double-check that `zoomLevels: {}` was added to the `toEqual` expectation in Step 1.1.

- [ ] **Step 1.5 — Commit**

```bash
git add packages/server/src/state.ts packages/server/src/state.test.ts
git commit -m "feat(server): add zoomLevels to AppState with plain-replacement updateState branch"
```

---

## Task 2: Client `AppState` interface

**Files:**
- Modify: `packages/web/src/lib/api.ts`

No new test needed — this is a type-only change; TypeScript strict mode will catch misuse at build time.

- [ ] **Step 2.1 — Add `zoomLevels` to client interface**

In `packages/web/src/lib/api.ts`, find the `AppState` interface (currently around line 64) and add the field:

```ts
export interface AppState {
  theme: 'light' | 'dark';
  projects: Project[];
  openTabs: Tab[];
  checkboxStates: Record<string, Record<string, boolean>>;
  keyboardShortcuts?: Record<string, string>;
  zoomLevels?: Record<string, number>;
}
```

- [ ] **Step 2.2 — Verify TypeScript compiles**

```bash
npm run build -w packages/web 2>&1 | grep -E 'error|warning|built'
```

Expected: `✓ built in` with no errors.

- [ ] **Step 2.3 — Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat(web): add zoomLevels to client AppState interface"
```

---

## Task 3: `MarkdownView` — zoom prop

**Files:**
- Modify: `packages/web/src/components/MarkdownView.tsx`

- [ ] **Step 3.1 — Add `zoom` prop and apply `fontSize` style**

In `packages/web/src/components/MarkdownView.tsx`:

1. Add `zoom?: number` to `MarkdownViewProps`:

```ts
interface MarkdownViewProps {
  content: string;
  onLinkClick: (target: string, kind: InternalLinkKind) => void;
  onCheckboxChange?: (index: number, checked: boolean) => void;
  zoom?: number;
}
```

2. Destructure it in the function signature:

```ts
export function MarkdownView({
  content,
  onLinkClick,
  onCheckboxChange,
  zoom = 1,
}: MarkdownViewProps) {
```

3. Apply the style to the outer div (line 252). Keep `ref={containerRef}` unchanged — both can coexist on the same element:

```tsx
  return (
    <div
      className="markdown-body prose prose-sm dark:prose-invert max-w-none"
      style={zoom !== 1 ? { fontSize: `${zoom * 100}%` } : undefined}
      ref={containerRef}
    >
```

- [ ] **Step 3.2 — Run the full web test suite to verify no regressions**

```bash
npm test -w packages/web 2>&1 | tail -10
```

Expected: `10 passed` (all existing tests still pass — `zoom` defaults to `1` so no visual change without explicit prop).

- [ ] **Step 3.3 — Commit**

```bash
git add packages/web/src/components/MarkdownView.tsx
git commit -m "feat(web): add zoom prop to MarkdownView (fontSize scaling)"
```

---

## Task 4: `App.tsx` — zoom state, helpers, pane controls

**Files:**
- Modify: `packages/web/src/App.tsx`

This is the largest task. Take it in sub-steps.

### 4a — Imports and state

- [ ] **Step 4a.1 — Add lucide icons to imports**

In `App.tsx`, add `ZoomIn` and `ZoomOut` to the lucide import block:

```ts
import {
  ArrowRightLeft,
  Columns2,
  Eye,
  Info,
  Maximize2,
  Menu,
  Minimize2,
  Pencil,
  RefreshCw,
  Save,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
```

- [ ] **Step 4a.2 — Add `fetchState` to the api import**

`fetchState` was added in the previous session. Verify it's already in the import (it should be from the keyboard shortcuts work). If not, add it:

```ts
import {
  // ...existing...
  fetchState,
  // ...
} from '@/lib/api';
```

- [ ] **Step 4a.3 — Extend `graphPreview` type and add zoom state**

Find the `graphPreview` state declaration (around line 122) and extend its type to include `projectId`:

```ts
const [graphPreview, setGraphPreview] = useState<{
  projectId: string;
  filePath: string;
  content: string;
} | null>(null);
```

Directly after the existing `keyboardShortcuts` state + effect (around lines 113–122), add zoom state and its load effect:

```ts
const [zoomLevels, setZoomLevels] = useState<Record<string, number>>({});

useEffect(() => {
  fetchState().then((s) => {
    if (s.zoomLevels) setZoomLevels(s.zoomLevels);
  }).catch(() => {});
}, []);
```

### 4b — Zoom helpers

- [ ] **Step 4b.1 — Add zoom helpers after `handleResetShortcut`**

Find the `handleResetShortcut` callback (added in the previous keyboard-shortcuts session) and add these three functions directly after it:

```ts
const getZoom = useCallback(
  (projectId: string, filePath: string): number => {
    return zoomLevels[`${projectId}:${filePath}`] ?? 1;
  },
  [zoomLevels],
);

const handleZoomChange = useCallback(
  (projectId: string, filePath: string, delta: number) => {
    const key = `${projectId}:${filePath}`;
    const current = zoomLevels[key] ?? 1;
    const next = Math.min(2, Math.max(0.5, Math.round((current + delta) * 10) / 10));
    if (next === 1) {
      const { [key]: _, ...rest } = zoomLevels;
      setZoomLevels(rest);
      updateState({ zoomLevels: rest }).catch(() => {});
    } else {
      const updated = { ...zoomLevels, [key]: next };
      setZoomLevels(updated);
      updateState({ zoomLevels: updated }).catch(() => {});
    }
  },
  [zoomLevels],
);

const handleZoomReset = useCallback(
  (projectId: string, filePath: string) => {
    const key = `${projectId}:${filePath}`;
    const { [key]: _, ...rest } = zoomLevels;
    setZoomLevels(rest);
    updateState({ zoomLevels: rest }).catch(() => {});
  },
  [zoomLevels],
);
```

### 4c — Fix `handleGraphNodeOpen`

- [ ] **Step 4c.1 — Include `projectId` when setting `graphPreview`**

Find `handleGraphNodeOpen` (around line 682). Update the `setGraphPreview` call to include `graphProjectId`:

```ts
const handleGraphNodeOpen = useCallback(
  async (filePath: string) => {
    if (!graphProjectId) return;
    try {
      const content = await fetchFileContent(graphProjectId, filePath);
      setGraphPreview({ projectId: graphProjectId, filePath, content });
    } catch {
      // ignore
    }
  },
  [graphProjectId],
);
```

### 4d — Zoom controls in pane toolbar

- [ ] **Step 4d.1 — Thread zoom into `renderMarkdownPane` and add controls**

`renderMarkdownPane` closes over `paneStates`, `editMode`, etc. It also needs to close over `getZoom`, `handleZoomChange`, `handleZoomReset` — add them to the dependency array too.

1. Inside `renderMarkdownPane`, after the `const tab = …` line at the top of the non-null tab branch, compute the zoom for this tab:

```ts
const zoom = tab ? getZoom(tab.projectId, tab.filePath) : 1;
```

2. Pass `zoom` to `MarkdownView` (find the `<MarkdownView content=…` call in the pane render):

```tsx
<MarkdownView
  content={paneState.content}
  zoom={zoom}
  onLinkClick={(target, kind) => handleLinkClick(pane, target, kind)}
  onCheckboxChange={(index, checked) =>
    handleCheckboxChange(pane, index, checked)
  }
/>
```

3. Add the zoom controls to the toolbar. They go **just before** the `{options.allowEdit && ...}` block, inside a `{!editMode && tab && ...}` guard:

```tsx
{!editMode && tab && (
  <>
    <div className="mx-1 h-4 w-px bg-border" />
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={(e) => {
        e.stopPropagation();
        handleZoomChange(tab.projectId, tab.filePath, -0.1);
      }}
      aria-label="Zoom out"
      title="Zoom out"
    >
      <ZoomOut className="size-4" />
    </Button>
    <button
      className="min-w-[3rem] text-center text-xs text-muted-foreground tabular-nums select-none"
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleZoomReset(tab.projectId, tab.filePath);
      }}
      title="Double-click to reset zoom"
    >
      {Math.round(zoom * 100)}%
    </button>
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={(e) => {
        e.stopPropagation();
        handleZoomChange(tab.projectId, tab.filePath, +0.1);
      }}
      aria-label="Zoom in"
      title="Zoom in"
    >
      <ZoomIn className="size-4" />
    </Button>
  </>
)}
```

4. Add `getZoom`, `handleZoomChange`, `handleZoomReset`, `zoomLevels` to the `renderMarkdownPane` `useCallback` dependency array.

### 4e — Pass zoom to `GraphPanel`

- [ ] **Step 4e.1 — Thread zoom callbacks to `GraphPanel`**

Find the `<GraphPanel … />` usage (around line 1104) and add the three new props:

```tsx
<GraphPanel
  projectName={graphProject.name}
  projectId={graphProject.id}
  graph={graphData}
  loading={graphLoading}
  openFilePaths={openFilePaths}
  onClose={() => setGraphProjectId(null)}
  onOpenFile={handleGraphNodeOpen}
  getZoom={getZoom}
  onZoomChange={handleZoomChange}
  onZoomReset={handleZoomReset}
/>
```

### 4f — Pass zoom to `GraphPreviewModal`

- [ ] **Step 4f.1 — Thread zoom to `GraphPreviewModal`**

Find the `{graphPreview && <GraphPreviewModal … />}` block (around line 1156) and update it:

```tsx
{graphPreview && (
  <GraphPreviewModal
    filePath={graphPreview.filePath}
    content={graphPreview.content}
    zoom={getZoom(graphPreview.projectId, graphPreview.filePath)}
    onZoomIn={() => handleZoomChange(graphPreview.projectId, graphPreview.filePath, +0.1)}
    onZoomOut={() => handleZoomChange(graphPreview.projectId, graphPreview.filePath, -0.1)}
    onZoomReset={() => handleZoomReset(graphPreview.projectId, graphPreview.filePath)}
    onClose={setGraphPreviewNull}
  />
)}
```

- [ ] **Step 4g — TypeScript build check**

```bash
npm run build -w packages/web 2>&1 | grep -E 'error TS|✓ built'
```

Expected: `✓ built in` with no `error TS` lines. Fix any type errors before continuing.

- [ ] **Step 4h — Commit**

```bash
git add packages/web/src/App.tsx
git commit -m "feat(web): zoom state, helpers, and pane toolbar zoom controls"
```

---

## Task 5: `GraphPanel` — zoom controls in `NodePreview`

**Files:**
- Modify: `packages/web/src/components/GraphPanel.tsx`

- [ ] **Step 5.1 — Add `ZoomIn`/`ZoomOut` to lucide imports**

At the top of `GraphPanel.tsx`, add to the lucide import:

```ts
import { X, Search, ZoomIn, ZoomOut, RotateCcw, Minus, Maximize2, Minimize2 } from 'lucide-react';
```

(`Minus`, `Maximize2`, `Minimize2` are already there from the previous session.)

- [ ] **Step 5.2 — Add zoom props to `GraphPanelProps`**

Find the `GraphPanelProps` interface and add:

```ts
interface GraphPanelProps {
  projectName: string;
  projectId: string;
  graph: ProjectGraph | null;
  loading: boolean;
  openFilePaths: Set<string>;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
  getZoom: (projectId: string, filePath: string) => number;
  onZoomChange: (projectId: string, filePath: string, delta: number) => void;
  onZoomReset: (projectId: string, filePath: string) => void;
}
```

- [ ] **Step 5.3 — Destructure zoom props in `GraphPanel`**

In the `GraphPanel` function signature, add:

```ts
export function GraphPanel({
  projectName,
  projectId,
  graph,
  loading,
  openFilePaths,
  onClose,
  onOpenFile,
  getZoom,
  onZoomChange,
  onZoomReset,
}: GraphPanelProps) {
```

- [ ] **Step 5.4 — Add zoom props to `NodePreview`**

Find the `NodePreview` function (around line 662). It is module-private. Extend its inline props:

```ts
function NodePreview({
  preview,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClose,
}: {
  preview: PreviewState;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClose: () => void;
}) {
```

- [ ] **Step 5.5 — Pass zoom to `NodePreview` at call site**

Find where `<NodePreview … />` is rendered inside `GraphPanel` (look for `{preview && <NodePreview`). Update the call to pass computed zoom and callbacks — `GraphPanel` owns `projectId` and `preview.filePath`:

```tsx
{preview && (
  <NodePreview
    preview={preview}
    zoom={getZoom(projectId, preview.filePath)}
    onZoomIn={() => onZoomChange(projectId, preview.filePath, +0.1)}
    onZoomOut={() => onZoomChange(projectId, preview.filePath, -0.1)}
    onZoomReset={() => onZoomReset(projectId, preview.filePath)}
    onClose={() => setPreview(null)}
  />
)}
```

- [ ] **Step 5.6 — Add zoom controls to `NodePreview` header and pass `zoom` to `MarkdownView`**

Inside `NodePreview`, find the `MarkdownView` in the normal/maximized render branch and add the `zoom` prop:

```tsx
<MarkdownView
  content={preview.content}
  zoom={zoom}
  onLinkClick={noop}
/>
```

In the non-minimized header (`flex shrink-0 items-center justify-between border-b px-4 py-2`), add zoom controls left of the existing minimize/maximize/close group. The current header looks like:

```tsx
<div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
  <span className="truncate text-sm font-medium">{preview.label}</span>
  <div className="flex gap-1">
    <Button … Minus … />   {/* minimize */}
    <Button … Maximize2/Minimize2 … />  {/* maximize/restore */}
    <Button … X … />       {/* close */}
  </div>
</div>
```

Replace the header with:

```tsx
<div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
  <span className="truncate text-sm font-medium">{preview.label}</span>
  <div className="flex items-center gap-1">
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onZoomOut}
      aria-label="Zoom out"
      title="Zoom out"
    >
      <ZoomOut className="size-4" />
    </Button>
    <button
      className="min-w-[3rem] text-center text-xs text-muted-foreground tabular-nums select-none"
      onDoubleClick={onZoomReset}
      title="Double-click to reset zoom"
    >
      {Math.round(zoom * 100)}%
    </button>
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onZoomIn}
      aria-label="Zoom in"
      title="Zoom in"
    >
      <ZoomIn className="size-4" />
    </Button>
    <div className="mx-1 h-4 w-px bg-border" />
    <Button variant="ghost" size="icon-sm" onClick={() => setModalState('minimized')} aria-label="Minimize preview" title="Minimize">
      <Minus className="size-4" />
    </Button>
    <Button variant="ghost" size="icon-sm" onClick={() => setModalState(modalState === 'maximized' ? 'normal' : 'maximized')} aria-label={modalState === 'maximized' ? 'Restore preview' : 'Maximize preview'} title={modalState === 'maximized' ? 'Restore' : 'Maximize'}>
      {modalState === 'maximized' ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </Button>
    <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close preview" title="Close">
      <X className="size-4" />
    </Button>
  </div>
</div>
```

Zoom controls do **not** appear in the minimized pill — it has no `MarkdownView`.

- [ ] **Step 5.7 — Build check**

```bash
npm run build -w packages/web 2>&1 | grep -E 'error TS|✓ built'
```

Expected: `✓ built in` with no errors.

- [ ] **Step 5.8 — Commit**

```bash
git add packages/web/src/components/GraphPanel.tsx
git commit -m "feat(web): add per-file zoom controls to NodePreview in GraphPanel"
```

---

## Task 6: `GraphPreviewModal` — zoom controls

**Files:**
- Modify: `packages/web/src/components/GraphPreviewModal.tsx`

- [ ] **Step 6.1 — Add zoom props and controls**

Replace the entire `GraphPreviewModal.tsx` with:

```tsx
import { ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/MarkdownView';

const noop = () => {};

interface GraphPreviewModalProps {
  filePath: string;
  content: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onClose: () => void;
}

export function GraphPreviewModal({
  filePath,
  content,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onClose,
}: GraphPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex h-[80vh] w-[75vw] max-w-4xl flex-col rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <span className="truncate text-sm font-medium">
            {filePath.split('/').pop()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onZoomOut}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut className="size-4" />
            </Button>
            <button
              className="min-w-[3rem] text-center text-xs text-muted-foreground tabular-nums select-none"
              onDoubleClick={onZoomReset}
              title="Double-click to reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onZoomIn}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn className="size-4" />
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
          <MarkdownView
            content={content}
            zoom={zoom}
            onLinkClick={noop}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.2 — Full build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` (all three packages).

- [ ] **Step 6.3 — Run all tests**

```bash
npm test 2>&1 | tail -15
```

Expected: `100 passed` (server, including 3 new zoom tests) + `65 passed` (web) — all green. If any tests fail, fix before proceeding.

- [ ] **Step 6.4 — Commit**

```bash
git add packages/web/src/components/GraphPreviewModal.tsx
git commit -m "feat(web): add per-file zoom controls to GraphPreviewModal"
```

---

## Task 7: README update and push

- [ ] **Step 7.1 — Update README feature list**

In `README.md`, find the line:

```
- Customizable keyboard shortcuts — remap any action from the shortcuts modal and changes persist across sessions
```

Add after it:

```
- Per-file zoom (50–200%) in all reading views — zoom level remembered per file across sessions
```

- [ ] **Step 7.2 — Commit and push**

```bash
git add README.md
git commit -m "docs: document per-file zoom feature"
git push
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npm run build` exits cleanly
- [ ] `npm test` — all 162 tests pass
- [ ] Open a markdown file → zoom in/out → close → reopen → zoom level restored
- [ ] Open same file in both panes of split view → zoom in one pane → both panes reflect same zoom (same file = same zoom)
- [ ] Hover a graph node 5s → preview appears → zoom in → MarkdownView text scales
- [ ] Double-click a graph node → `GraphPreviewModal` appears → zoom controls work
- [ ] Double-click `%` badge → zoom resets to 100% and key removed from state
- [ ] Zoom level at 100% (default) → no entry written to `~/.ezmdv/state.json`
