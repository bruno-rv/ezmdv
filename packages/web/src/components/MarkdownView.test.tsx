import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownView } from './MarkdownView';

describe('MarkdownView', () => {
  it('emits wiki-link navigation events', () => {
    const onLinkClick = vi.fn();

    render(
      <MarkdownView
        content="Open [[Guide Note]]."
        onLinkClick={onLinkClick}
      />,
    );

    const anchor = screen.getByText('Guide Note').closest('a');
    expect(anchor).not.toBeNull();
    fireEvent.click(anchor!);

    expect(onLinkClick).toHaveBeenCalledWith('Guide Note', 'wiki');
  });

  it('adds stable ids to headings for anchor navigation', () => {
    render(
      <MarkdownView
        content={'# Alpha Section\n\nBody'}
        onLinkClick={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /alpha section/i })).toHaveAttribute(
      'id',
      'alpha-section',
    );
  });
});
