import { EditorView } from '@codemirror/view';

/**
 * When the user types --- on an empty line and presses Enter,
 * ensure proper horizontal rule formatting with newlines.
 */
export function markdownInputRules() {
  return EditorView.inputHandler.of((view, from, to, text) => {
    // Only care about the last character typed
    if (text !== '-') return false;

    const line = view.state.doc.lineAt(from);
    const lineText = line.text;

    // Check if typing this '-' completes '---' on the line
    const textBefore = lineText.slice(0, from - line.from) + text;
    if (textBefore.trim() === '---') {
      // Let it go through normally - markdown will render it as <hr>
      return false;
    }
    return false;
  });
}

/**
 * Extension that auto-formats --- with proper spacing when Enter is pressed after it.
 * Ensures blank line before --- if not at doc start, for proper markdown HR rendering.
 */
export function hrAutoFormat() {
  return EditorView.domEventHandlers({
    keydown(event: KeyboardEvent, view: EditorView) {
      if (event.key !== 'Enter') return false;

      const pos = view.state.selection.main.head;
      const line = view.state.doc.lineAt(pos);
      const trimmed = line.text.trim();

      if (trimmed !== '---' && trimmed !== '***' && trimmed !== '___') return false;

      // Check if previous line is blank (for proper HR formatting)
      if (line.number > 1) {
        const prevLine = view.state.doc.line(line.number - 1);
        if (prevLine.text.trim() !== '') {
          // Insert a blank line before the --- to ensure it renders as HR
          event.preventDefault();
          view.dispatch({
            changes: [
              { from: line.from, insert: '\n' },
              { from: pos, insert: '\n' },
            ],
            selection: { anchor: pos + 2 },
          });
          return true;
        }
      }

      return false;
    },
  });
}
