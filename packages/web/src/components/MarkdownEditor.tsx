import { useState, useCallback, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';
import { search } from '@codemirror/search';
import { wikiLinkSource } from '@/lib/wikiLinkCompletion';
import { hrAutoFormat } from '@/lib/markdownInputRules';
import { uploadImage } from '@/lib/api';
import { slashMenuField, slashCommandKeymap, getFilteredCommands, applySlashCommand, detectSlashMenu, setSlashMenu, closeSlashMenu, type SlashMenuState } from '@/lib/slashCommandExtension';
import { SlashCommandMenu } from './SlashCommandMenu';

interface MarkdownEditorProps {
  content: string;
  theme: 'light' | 'dark';
  onChange: (value: string) => void;
  filePaths?: string[];
  projectId?: string;
}

function insertImageFromFile(view: EditorView, file: File, projectId: string) {
  const placeholder = `![Uploading ${file.name}...](...)`;
  const from = view.state.selection.main.head;
  view.dispatch({ changes: { from, insert: placeholder } });

  uploadImage(projectId, file)
    .then(({ path }) => {
      const doc = view.state.doc.toString();
      const placeholderIdx = doc.indexOf(placeholder);
      if (placeholderIdx === -1) return;
      const replacement = `![${file.name}](${path})`;
      view.dispatch({
        changes: { from: placeholderIdx, to: placeholderIdx + placeholder.length, insert: replacement },
      });
    })
    .catch(() => {
      const doc = view.state.doc.toString();
      const placeholderIdx = doc.indexOf(placeholder);
      if (placeholderIdx === -1) return;
      const replacement = `![Upload failed: ${file.name}]()`;
      view.dispatch({
        changes: { from: placeholderIdx, to: placeholderIdx + placeholder.length, insert: replacement },
      });
    });
}

export function MarkdownEditor({ content, theme, onChange, filePaths, projectId }: MarkdownEditorProps) {
  const [slashMenu, setSlashMenuState] = useState<SlashMenuState | null>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const handleChange = useCallback(
    (value: string) => {
      onChange(value);
    },
    [onChange],
  );

  const handleEditorUpdate = useCallback((viewUpdate: ViewUpdate) => {
    const view = viewUpdate.view;
    const currentField = view.state.field(slashMenuField);

    if (!viewUpdate.docChanged && !viewUpdate.selectionSet) {
      setSlashMenuState(prev => {
        if (!currentField.open) return prev === null ? prev : null;
        if (prev && prev.selectedIndex === currentField.selectedIndex && prev.query === currentField.query) return prev;
        return currentField;
      });
      return;
    }

    const detected = detectSlashMenu(view);

    if (detected) {
      if (!currentField.open || currentField.query !== detected.query || currentField.from !== detected.from) {
        view.dispatch({
          effects: setSlashMenu.of({
            open: true,
            query: detected.query,
            from: detected.from,
            selectedIndex: currentField.open ? currentField.selectedIndex : 0,
            position: detected.position,
          }),
        });
      }
      setSlashMenuState(prev => {
        if (prev && prev.query === detected.query && prev.from === detected.from) {
          return { ...prev, position: detected.position };
        }
        return detected;
      });
    } else {
      if (currentField.open) {
        view.dispatch({ effects: closeSlashMenu.of(undefined) });
      }
      setSlashMenuState(null);
    }
  }, []);

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      autocompletion({ override: [wikiLinkSource(filePaths ?? [])], closeOnBlur: true }),
      search({ top: true }),
      hrAutoFormat(),
      slashMenuField,
      Prec.highest(EditorView.domEventHandlers({
        keydown(event: KeyboardEvent, view: EditorView) {
          return slashCommandKeymap(view, event);
        },
      })),
      EditorView.domEventHandlers({
        ...(projectId
          ? {
              paste(event: ClipboardEvent, view: EditorView) {
                const items = Array.from(event.clipboardData?.items ?? []);
                const imageItem = items.find((item) => item.type.startsWith('image/'));
                if (!imageItem) return false;

                event.preventDefault();
                const blob = imageItem.getAsFile();
                if (!blob) return true;

                const ext = blob.type.split('/')[1]?.replace('svg+xml', 'svg') ?? 'png';
                const file = new File([blob], `pasted-image.${ext}`, { type: blob.type });
                insertImageFromFile(view, file, projectId);
                return true;
              },
              drop(event: DragEvent, view: EditorView) {
                const files = Array.from(event.dataTransfer?.files ?? []);
                const imageFiles = files.filter((f) => f.type.startsWith('image/'));
                if (imageFiles.length === 0) return false;

                event.preventDefault();
                for (const file of imageFiles) {
                  insertImageFromFile(view, file, projectId);
                }
                return true;
              },
            }
          : {}),
      }),
    ],
    [filePaths, projectId],
  );

  const menuState = slashMenu ?? (editorRef.current?.view ? (() => {
    const s = editorRef.current!.view!.state.field(slashMenuField);
    return s.open ? s : null;
  })() : null);
  const filteredCommands = menuState ? getFilteredCommands(menuState.query) : [];

  return (
    <div className="relative h-full">
      <CodeMirror
        ref={editorRef}
        value={content}
        theme={theme}
        extensions={extensions}
        onChange={handleChange}
        onUpdate={handleEditorUpdate}
        className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:!font-mono [&_.cm-scroller]:text-sm"
        height="100%"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          foldGutter: true,
          bracketMatching: true,
          indentOnInput: true,
          searchKeymap: false,
        }}
      />
      {menuState && filteredCommands.length > 0 && (
        <SlashCommandMenu
          commands={filteredCommands}
          selectedIndex={menuState.selectedIndex}
          position={menuState.position}
          onSelect={(cmd) => {
            const view = editorRef.current?.view;
            if (view) applySlashCommand(view, cmd, menuState.from);
          }}
        />
      )}
    </div>
  );
}
