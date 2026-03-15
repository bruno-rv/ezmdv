import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders heading with correct tag level', () => {
    render(
      <CollapsibleSection level={2}>
        Section Title
      </CollapsibleSection>,
    );
    const heading = screen.getByRole('button', { name: /Section Title/i });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H2');
  });

  it('starts expanded by default', () => {
    render(
      <CollapsibleSection level={1}>
        Heading
      </CollapsibleSection>,
    );
    const heading = screen.getByRole('button', { name: /Heading/i });
    expect(heading).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles aria-expanded on click', () => {
    render(
      <CollapsibleSection level={3}>
        Click Me
      </CollapsibleSection>,
    );
    const heading = screen.getByRole('button', { name: /Click Me/i });

    expect(heading).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles on Enter key press', () => {
    render(
      <CollapsibleSection level={2}>
        Keyboard Test
      </CollapsibleSection>,
    );
    const heading = screen.getByRole('button', { name: /Keyboard Test/i });

    expect(heading).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(heading, { key: 'Enter' });
    expect(heading).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles on Space key press', () => {
    render(
      <CollapsibleSection level={2}>
        Space Test
      </CollapsibleSection>,
    );
    const heading = screen.getByRole('button', { name: /Space Test/i });

    expect(heading).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(heading, { key: ' ' });
    expect(heading).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders chevron icon', () => {
    render(
      <CollapsibleSection level={1}>
        With Chevron
      </CollapsibleSection>,
    );
    // The chevron SVG should be present (lucide-react renders an SVG)
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('accepts and applies id prop', () => {
    render(
      <CollapsibleSection level={2} id="my-section">
        ID Test
      </CollapsibleSection>,
    );
    const heading = screen.getByRole('button', { name: /ID Test/i });
    expect(heading).toHaveAttribute('id', 'my-section');
  });
});
