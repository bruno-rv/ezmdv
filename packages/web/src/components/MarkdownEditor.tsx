import { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import { wikiLinkSource } from '@/lib/wikiLinkCompletion';

interface MarkdownEditorProps {
  content: string;
  theme: 'light' | 'dark';
  onChange: (value: string) => void;
  filePaths?: string[];
}

export function MarkdownEditor({ content, theme, onChange, filePaths }: MarkdownEditorProps) {
  const handleChange = useCallback(
    (value: string) => {
      onChange(value);
    },
    [onChange],
  );

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      autocompletion({ override: [wikiLinkSource(filePaths ?? [])], closeOnBlur: true }),
    ],
    [filePaths],
  );

  return (
    <CodeMirror
      value={content}
      theme={theme}
      extensions={extensions}
      onChange={handleChange}
      className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:!font-mono [&_.cm-scroller]:text-sm"
      height="100%"
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        foldGutter: true,
        bracketMatching: true,
        indentOnInput: true,
      }}
    />
  );
}
