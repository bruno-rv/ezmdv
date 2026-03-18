export interface ShortcutDef {
  id: string;
  description: string;
  defaultBinding: string; // e.g. 'mod+s', 'mod+shift+a'
  customizable: boolean;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  { id: 'save',          description: 'Save file',            defaultBinding: 'mod+s',         customizable: true },
  { id: 'toggleEdit',    description: 'Toggle edit mode',     defaultBinding: 'mod+e',         customizable: true },
  { id: 'closeTab',      description: 'Close focused tab',    defaultBinding: 'mod+w',         customizable: true },
  { id: 'nextTab',       description: 'Next tab',             defaultBinding: 'mod+]',         customizable: true },
  { id: 'prevTab',       description: 'Previous tab',         defaultBinding: 'mod+[',         customizable: true },
  { id: 'autoScroll',    description: 'Toggle autoscroll',    defaultBinding: 'mod+shift+a',   customizable: true },
  { id: 'refresh',       description: 'Refresh from disk',    defaultBinding: 'mod+shift+r',   customizable: true },
  { id: 'toggleToc',     description: 'Toggle table of contents', defaultBinding: 'mod+shift+t', customizable: true },
  { id: 'exitFullscreen', description: 'Exit fullscreen',     defaultBinding: 'escape',        customizable: false },
  { id: 'commandPalette', description: 'Command palette',      defaultBinding: 'mod+k',         customizable: false },
];

export const EDITOR_SHORTCUTS = [
  { key: 'mod+f', description: 'Find' },
  { key: 'mod+h', description: 'Find & Replace' },
];

export const GRAPH_SHORTCUTS = [
  { key: 'Double-click node', description: 'Open file' },
  { key: 'Drag node',         description: 'Reposition' },
  { key: 'Scroll wheel',      description: 'Zoom in/out' },
  { key: '+ / =',             description: 'Zoom in' },
  { key: '-',                 description: 'Zoom out' },
  { key: '0',                 description: 'Reset zoom' },
  { key: 'Shift + Drag',      description: 'Pan view' },
];

interface ParsedBinding {
  mod: boolean;
  shift: boolean;
  key: string; // lowercase
}

export function parseBinding(binding: string): ParsedBinding {
  const parts = binding.toLowerCase().split('+');
  const mod = parts.includes('mod');
  const shift = parts.includes('shift');
  const key = parts.find((p) => p !== 'mod' && p !== 'shift') ?? '';
  return { mod, shift, key };
}

export function formatBindingForDisplay(binding: string): string {
  const { mod, shift, key } = parseBinding(binding);
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const modStr = mod ? (isMac ? '⌘' : 'Ctrl') : '';
  const shiftStr = shift ? 'Shift' : '';
  const keyStr = key === 'escape' ? 'Esc' : key.toUpperCase();

  return [modStr, shiftStr, keyStr].filter(Boolean).join(' + ');
}

export function matchesEvent(binding: string, e: KeyboardEvent): boolean {
  const { mod, shift, key } = parseBinding(binding);
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const eventMod = isMac ? e.metaKey : e.ctrlKey;
  if (mod !== eventMod) return false;
  if (shift !== e.shiftKey) return false;
  const eventKey = e.key.toLowerCase();
  // Handle special keys
  if (key === 'escape') return eventKey === 'escape';
  return eventKey === key;
}

export function bindingFromEvent(e: KeyboardEvent): string {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const shift = e.shiftKey;
  const key = e.key.toLowerCase();

  const parts: string[] = [];
  if (mod) parts.push('mod');
  if (shift) parts.push('shift');
  parts.push(key);
  return parts.join('+');
}

export function getEffectiveBindings(
  overrides: Record<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const def of SHORTCUT_DEFS) {
    map.set(def.id, overrides[def.id] ?? def.defaultBinding);
  }
  return map;
}
