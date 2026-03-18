import { StateField, StateEffect } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { slashCommands, type SlashCommand } from './slashCommands';

export interface SlashMenuState {
  open: boolean;
  query: string;
  from: number;
  selectedIndex: number;
  position: { top: number; left: number };
}

const initialState: SlashMenuState = {
  open: false,
  query: '',
  from: 0,
  selectedIndex: 0,
  position: { top: 0, left: 0 },
};

export const setSlashMenu = StateEffect.define<Partial<SlashMenuState> & { open: boolean }>();
export const closeSlashMenu = StateEffect.define<void>();

export const slashMenuField = StateField.define<SlashMenuState>({
  create: () => initialState,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSlashMenu)) {
        return { ...value, ...e.value };
      }
      if (e.is(closeSlashMenu)) {
        return initialState;
      }
    }
    return value;
  },
});

export function getFilteredCommands(query: string): SlashCommand[] {
  if (!query) return slashCommands;
  const lower = query.toLowerCase();
  return slashCommands.filter(
    (cmd) => cmd.label.toLowerCase().includes(lower) || cmd.description.toLowerCase().includes(lower),
  );
}

export function applySlashCommand(view: EditorView, command: SlashCommand, from: number) {
  const to = view.state.selection.main.head;
  const insert = typeof command.insert === 'string' ? command.insert : '';

  if (typeof command.insert === 'function') {
    view.dispatch({ changes: { from, to } });
    command.insert(view);
  } else {
    if (insert.startsWith('```\n')) {
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 4 },
      });
    } else if (insert === '****') {
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 2 },
      });
    } else if (insert === '**') {
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 1 },
      });
    } else {
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
      });
    }
  }

  view.dispatch({ effects: closeSlashMenu.of(undefined) });
  view.focus();
}

export function slashCommandKeymap(view: EditorView, event: KeyboardEvent): boolean {
  const state = view.state.field(slashMenuField);
  if (!state.open) return false;

  const filtered = getFilteredCommands(state.query);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const next = (state.selectedIndex + 1) % Math.max(filtered.length, 1);
    view.dispatch({ effects: setSlashMenu.of({ ...state, open: true, selectedIndex: next }) });
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    const next = (state.selectedIndex - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1);
    view.dispatch({ effects: setSlashMenu.of({ ...state, open: true, selectedIndex: next }) });
    return true;
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault();
    if (filtered.length > 0) {
      applySlashCommand(view, filtered[state.selectedIndex], state.from);
    }
    return true;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    view.dispatch({ effects: closeSlashMenu.of(undefined) });
    return true;
  }
  return false;
}

export function detectSlashMenu(view: EditorView): SlashMenuState | null {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const textBefore = line.text.slice(0, pos - line.from);
  const slashMatch = textBefore.match(/(?:^|\s)\/([\w]*)$/);

  if (slashMatch) {
    const slashPos = line.from + textBefore.lastIndexOf('/');
    const query = slashMatch[1];
    const coords = view.coordsAtPos(pos);
    if (coords) {
      const editorRect = view.dom.getBoundingClientRect();
      return {
        open: true,
        query,
        from: slashPos,
        selectedIndex: 0,
        position: {
          top: coords.bottom - editorRect.top,
          left: coords.left - editorRect.left,
        },
      };
    }
  }
  return null;
}
