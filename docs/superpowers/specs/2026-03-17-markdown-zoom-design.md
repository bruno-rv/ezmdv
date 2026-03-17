# Markdown Zoom — Design Spec

**Date:** 2026-03-17
**Status:** Approved

## Summary

Add per-file font-size zoom to all markdown reading surfaces: the main reading pane (both halves of split view) and both graph preview modals (hover `NodePreview` inside `GraphPanel`, double-click `GraphPreviewModal`). Zoom level is saved per `.md` file and persists across sessions.

---

## Zoom Mechanic

**Approach:** CSS `fontSize` on the prose container inside `MarkdownView`.

```tsx
// MarkdownView.tsx — add style alongside the existing ref={containerRef}
// containerRef is a useCallback ref used for footnote extraction; keep it unchanged
<div
  className="markdown-body prose prose-sm dark:prose-invert max-w-none"
  style={{ fontSize: `${zoom * 100}%` }}
  ref={containerRef}
>
```

Tailwind `prose` typography is relative to the container's font-size, so all text (headings, body, code, blockquotes) scales proportionally. No transform hacks, no layout side-effects.

- **Range:** 50%–200% (values `0.5`–`2.0`)
- **Step:** 10% per button click (`±0.1`)
- **Default:** 1.0 (100%) — no entry written to state for default
- **Reset:** double-click the `%` badge removes the key from state, returning to 100%

---

## Data Model

### Server (`packages/server/src/state.ts`)

```ts
export interface AppState {
  // ...existing fields...
  zoomLevels?: Record<string, number>; // "projectId:filePath" → zoom (0.5–2.0)
}

const DEFAULT_STATE: AppState = {
  // ...
  zoomLevels: {},
};
```

`zoomLevels` is a flat `Record<string, number>` (one level deep). The top-level shallow spread in `updateState` (`{ ...current, ...partial }`) would **replace the entire `zoomLevels` map** when any zoom key is saved, silently dropping all other saved zoom levels. A branch is required to handle it correctly.

The client always sends the **full updated map** (every `handleZoomChange` and `handleZoomReset` sends the complete `zoomLevels` object, not a partial patch). Therefore the correct server behavior is a **plain replacement** — not an additive merge. An additive merge would cause deleted keys (from `handleZoomReset`) to reappear from the server's old state, silently breaking resets after reload:

```ts
// In updateState() — required: plain replacement, not additive merge
if (partial.zoomLevels !== undefined) {
  merged.zoomLevels = partial.zoomLevels;
}
```

This differs from `checkboxStates` (which uses an additive merge) because `checkboxStates` sends individual key patches, not the full map.

### Client (`packages/web/src/lib/api.ts`)

```ts
export interface AppState {
  // ...existing fields...
  zoomLevels?: Record<string, number>;
}
```

---

## MarkdownView

**File:** `packages/web/src/components/MarkdownView.tsx`

Add `zoom?: number` prop (default `1.0`). Apply as `style={{ fontSize: \`${zoom * 100}%\` }}` on the outer `markdown-body` div. The existing `ref={containerRef}` (footnote extraction callback ref) stays unchanged on the same element — `ref` and `style` coexist without conflict.

No other changes to `MarkdownView`.

---

## Controls

### Reading pane toolbar (`App.tsx` → `renderMarkdownPane`)

Controls appear at the far right of the pane toolbar, after a separator, in **view mode only** (hidden in edit mode):

```
[−]  100%  [+]
```

- `−` → `ZoomOut` lucide icon, calls `handleZoomChange(projectId, filePath, -0.1)`
- `+` → `ZoomIn` lucide icon, calls `handleZoomChange(projectId, filePath, +0.1)`
- `100%` → plain text badge; double-click calls `handleZoomReset(projectId, filePath)`
- Applies to both primary and secondary panes independently (each pane uses its own tab's file key)

### Graph preview modal header — `NodePreview` in `GraphPanel.tsx`

`GraphPanel` already has `projectId` as a prop. It computes the zoom scalar itself before passing it to `NodePreview`:

```tsx
// In GraphPanel, where NodePreview is rendered:
const previewZoom = getZoom(projectId, preview.filePath);
<NodePreview
  preview={preview}
  zoom={previewZoom}
  onZoomIn={() => onZoomChange(projectId, preview.filePath, +0.1)}
  onZoomOut={() => onZoomChange(projectId, preview.filePath, -0.1)}
  onZoomReset={() => onZoomReset(projectId, preview.filePath)}
  onClose={...}
/>
```

`GraphPanel` receives three new props from `App`: `getZoom`, `onZoomChange`, `onZoomReset`.

`NodePreview` receives scalar `zoom` + three callbacks — it has no knowledge of `projectId` or keys.

`NodePreview` is a module-private function inside `GraphPanel.tsx` (not exported). Extend its inline props signature directly. Add a separator element between the zoom group and the existing min/max/close group — the separator does not currently exist and must be added.

Zoom controls appear only in the **normal and maximized** states (where `MarkdownView` is visible). They are **omitted from the minimized pill** — the minimized state renders only a title bar with restore and close; adding zoom there would be meaningless and cluttered.

```
[filename]   [−] 100% [+]  │  [minimize] [maximize] [close]
```

### Graph preview modal — `GraphPreviewModal.tsx`

`graphPreview` state in `App.tsx` is `{ filePath: string; content: string }`. Extend it to include `projectId`:

```ts
const [graphPreview, setGraphPreview] = useState<{
  projectId: string;
  filePath: string;
  content: string;
} | null>(null);
```

Update the one place in `App.tsx` where `setGraphPreview` is called with a new value (in `handleGraphNodeOpen`) to include `graphProjectId`. The existing `if (!graphProjectId) return` null-guard at the top of that function ensures `graphProjectId` is always a non-null `string` by the time `setGraphPreview` is called — no additional guard is needed.

`App` then computes:
```ts
const previewZoom = graphPreview ? getZoom(graphPreview.projectId, graphPreview.filePath) : 1.0;
```

And passes scalar `zoom` + callbacks to `GraphPreviewModal` (same pattern as `NodePreview`).

---

## State Management in App.tsx

```ts
const [zoomLevels, setZoomLevels] = useState<Record<string, number>>({});

// Load on mount (same pattern as keyboardShortcuts)
useEffect(() => {
  fetchState().then((s) => {
    if (s.zoomLevels) setZoomLevels(s.zoomLevels);
  }).catch(() => {});
}, []);

function zoomKey(projectId: string, filePath: string) {
  return `${projectId}:${filePath}`;
}

function getZoom(projectId: string, filePath: string): number {
  return zoomLevels[zoomKey(projectId, filePath)] ?? 1.0;
}

function handleZoomChange(projectId: string, filePath: string, delta: number) {
  const key = zoomKey(projectId, filePath);
  const current = zoomLevels[key] ?? 1.0;
  const next = Math.min(2.0, Math.max(0.5, Math.round((current + delta) * 10) / 10));
  if (next === 1.0) {
    handleZoomReset(projectId, filePath);
  } else {
    const updated = { ...zoomLevels, [key]: next };
    setZoomLevels(updated);
    updateState({ zoomLevels: updated }).catch(() => {});
  }
}

function handleZoomReset(projectId: string, filePath: string) {
  const key = zoomKey(projectId, filePath);
  const { [key]: _, ...rest } = zoomLevels;
  setZoomLevels(rest);
  updateState({ zoomLevels: rest }).catch(() => {});
}
```

`getZoom`, `handleZoomChange`, and `handleZoomReset` are passed as callbacks into `renderMarkdownPane`, `GraphPanel`, and `GraphPreviewModal`.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/server/src/state.ts` | Add `zoomLevels` to `AppState` + `DEFAULT_STATE`; simple spread merge in `updateState` |
| `packages/web/src/lib/api.ts` | Add `zoomLevels` to client `AppState` |
| `packages/web/src/components/MarkdownView.tsx` | Add `zoom?: number` prop, apply as `fontSize` style (alongside existing `ref={containerRef}`) |
| `packages/web/src/App.tsx` | Add zoom state + helpers; extend `graphPreview` state with `projectId`; thread to panes + modals |
| `packages/web/src/components/GraphPanel.tsx` | Add `getZoom`/`onZoomChange`/`onZoomReset` props; compute scalar zoom before passing to `NodePreview`; `NodePreview` renders zoom controls |
| `packages/web/src/components/GraphPreviewModal.tsx` | Add `zoom`/`onZoomIn`/`onZoomOut`/`onZoomReset` props + controls to modal header |
| `packages/server/src/state.test.ts` | Update default state snapshot to include `zoomLevels: {}` |

---

## Out of Scope

- Zoom keyboard shortcuts (not requested)
- Zoom in edit mode (edit mode is for writing, not reading)
- Per-pane zoom independent of file (zoom follows the file, not the pane)
