# Markdown Zoom — Design Spec

**Date:** 2026-03-17
**Status:** Approved

## Summary

Add per-file font-size zoom to all markdown reading surfaces: the main reading pane (both halves of split view) and both graph preview modals (hover `NodePreview` inside `GraphPanel`, double-click `GraphPreviewModal`). Zoom level is saved per `.md` file and persists across sessions.

---

## Zoom Mechanic

**Approach:** CSS `fontSize` on the prose container inside `MarkdownView`.

```tsx
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

`updateState` already does a shallow merge. `zoomLevels` needs the same deep-merge treatment as `checkboxStates` so changing one file's zoom doesn't overwrite others.

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

Add `zoom?: number` prop (default `1.0`). Apply as `style={{ fontSize: \`${zoom * 100}%\` }}` on the outer `markdown-body` div.

No other changes to `MarkdownView`.

---

## Controls

### Reading pane toolbar (`App.tsx` → `renderMarkdownPane`)

Controls appear at the far right of the pane toolbar, after a separator, in view mode only (not edit mode):

```
[−]  100%  [+]
```

- `−` → `ZoomOut` lucide icon, decrements zoom by 0.1 (min 0.5)
- `+` → `ZoomIn` lucide icon, increments zoom by 0.1 (max 2.0)
- `100%` → plain text badge; double-click resets zoom to default (removes key from state)
- Hidden in edit mode (edit mode is text-editing, not reading)
- Applies to both primary and secondary panes independently (each pane uses its own tab's file key)

### Graph preview modal header — `NodePreview` in `GraphPanel.tsx`

Zoom buttons sit left of the separator, minimize/maximize/close remain on the right:

```
[filename]   [−] 100% [+]  │  [minimize] [maximize] [close]
```

`NodePreview` receives `zoom`, `onZoomIn`, `onZoomOut`, `onZoomReset` props from `GraphPanel`. `GraphPanel` receives `getZoom` and `onZoomChange` callbacks from `App`.

### Graph preview modal — `GraphPreviewModal.tsx`

Same layout as `NodePreview`. Receives `zoom`, `onZoomIn`, `onZoomOut`, `onZoomReset` props from `App`.

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

// Key helper
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
    // Remove key — default
    const { [key]: _, ...rest } = zoomLevels;
    setZoomLevels(rest);
    updateState({ zoomLevels: rest }).catch(() => {});
  } else {
    const next2 = { ...zoomLevels, [key]: next };
    setZoomLevels(next2);
    updateState({ zoomLevels: next2 }).catch(() => {});
  }
}
```

`getZoom` and `handleZoomChange` are passed as callbacks into `renderMarkdownPane`, `GraphPanel`, and `GraphPreviewModal`.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/server/src/state.ts` | Add `zoomLevels` to `AppState` + `DEFAULT_STATE`; deep-merge in `updateState` |
| `packages/web/src/lib/api.ts` | Add `zoomLevels` to client `AppState` |
| `packages/web/src/components/MarkdownView.tsx` | Add `zoom?: number` prop, apply as `fontSize` style |
| `packages/web/src/App.tsx` | Add zoom state, load on mount, `getZoom`/`handleZoomChange` helpers, thread to panes + modals |
| `packages/web/src/components/GraphPanel.tsx` | Thread zoom callbacks through to `NodePreview`; `NodePreview` renders zoom controls |
| `packages/web/src/components/GraphPreviewModal.tsx` | Add zoom props + controls to modal header |
| `packages/server/src/state.test.ts` | Update default state snapshot to include `zoomLevels: {}` |

---

## Server `updateState` deep-merge addition

```ts
if (partial.zoomLevels) {
  merged.zoomLevels = { ...current.zoomLevels, ...partial.zoomLevels };
}
```

---

## Out of Scope

- Zoom keyboard shortcuts (not requested)
- Zoom in edit mode (edit mode is for writing, not reading)
- Per-pane zoom independent of file (zoom follows the file, not the pane)
