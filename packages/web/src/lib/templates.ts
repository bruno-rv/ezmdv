export interface Template {
  id: string;
  name: string;
  icon: string;
  content: string;
}

export const templates: Template[] = [
  {
    id: 'blank',
    name: 'Blank',
    icon: 'FileText',
    content: '',
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    icon: 'Users',
    content: `# Meeting Notes — {{date}}

## Attendees

-

## Agenda

1.

## Discussion

-

## Action Items

- [ ]
`,
  },
  {
    id: 'readme',
    name: 'README',
    icon: 'BookOpen',
    content: `# {{filename}}

## Description



## Installation

\`\`\`bash

\`\`\`

## Usage

\`\`\`bash

\`\`\`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT
`,
  },
  {
    id: 'journal',
    name: 'Journal Entry',
    icon: 'PenLine',
    content: `# Journal — {{date}}

## Highlights

-

## Tasks

- [ ]

## Reflections

`,
  },
  {
    id: 'project-plan',
    name: 'Project Plan',
    icon: 'Target',
    content: `# {{filename}} — Project Plan

## Overview



## Goals

- [ ]

## Milestones

### Phase 1



### Phase 2



## Tasks

- [ ]
- [ ]
- [ ]
`,
  },
  {
    id: 'bug-report',
    name: 'Bug Report',
    icon: 'Bug',
    content: `# Bug Report

## Description



## Steps to Reproduce

1.

## Expected Behavior



## Actual Behavior



## Environment

- OS:
- Browser:
- Version:
`,
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    icon: 'CalendarDays',
    content: `# Weekly Review — {{date}}

## Accomplishments

-

## Challenges

-

## Next Week Goals

- [ ]
- [ ]
- [ ]
`,
  },
  {
    id: 'checklist',
    name: 'Checklist',
    icon: 'ListChecks',
    content: `# {{filename}}

- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
`,
  },
];

export function formatTemplate(
  template: Template,
  vars: { date: string; filename: string },
): string {
  if (!template.content) return '';
  return template.content
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{filename\}\}/g, vars.filename);
}
