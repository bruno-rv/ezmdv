import { EditorView } from '@codemirror/view';

export interface SlashCommand {
  label: string;
  description: string;
  icon: string;
  insert: string | ((view: EditorView) => void);
}

export const slashCommands: SlashCommand[] = [
  { label: 'Heading 1', description: 'Large section heading', icon: 'heading-1', insert: '# ' },
  { label: 'Heading 2', description: 'Medium section heading', icon: 'heading-2', insert: '## ' },
  { label: 'Heading 3', description: 'Small section heading', icon: 'heading-3', insert: '### ' },
  { label: 'Bulleted List', description: 'Create a bulleted list', icon: 'list', insert: '- ' },
  { label: 'Numbered List', description: 'Create a numbered list', icon: 'list-ordered', insert: '1. ' },
  { label: 'Task List', description: 'Track tasks with checkboxes', icon: 'check-square', insert: '- [ ] ' },
  { label: 'Code Block', description: 'Insert a code block', icon: 'code', insert: '```\n\n```' },
  { label: 'Quote', description: 'Insert a blockquote', icon: 'quote', insert: '> ' },
  { label: 'Divider', description: 'Insert a horizontal rule', icon: 'minus', insert: '\n---\n' },
  { label: 'Table', description: 'Insert a table', icon: 'table', insert: '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell 1 | Cell 2 | Cell 3 |\n' },
  { label: 'Image', description: 'Insert an image', icon: 'image', insert: '![alt text](url)' },
  { label: 'Link', description: 'Insert a link', icon: 'link', insert: '[text](url)' },
  { label: 'Bold', description: 'Bold text', icon: 'bold', insert: '****' },
  { label: 'Italic', description: 'Italic text', icon: 'italic', insert: '**' },
  { label: 'Callout', description: 'Highlighted info box', icon: 'alert-circle', insert: '> [!NOTE]\n> ' },
];
