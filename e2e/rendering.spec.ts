import { test, expect } from '@playwright/test';

test.describe('Markdown Rendering', () => {
  test.beforeEach(async ({ page, request }) => {
    // Clear any persisted tabs from previous test runs
    await request.patch('/api/state', {
      data: { openTabs: [] },
    });

    await page.goto('/');

    // Expand project and open README.md
    const sidebar = page.locator('aside');
    await sidebar.getByText('test-docs').click();
    await sidebar.getByText('README.md').click();

    // Wait for content to load
    const main = page.locator('main');
    await expect(main.locator('h1', { hasText: 'Test Project' })).toBeVisible();
  });

  test('heading renders as h1 element', async ({ page }) => {
    // The heading should be rendered as an actual <h1>, not raw "#"
    const h1 = page.locator('h1', { hasText: 'Test Project' });
    await expect(h1).toBeVisible();
  });

  test('code block has syntax highlighting', async ({ page }) => {
    // Code block should have the hljs class for syntax highlighting
    const codeBlock = page.locator('code.hljs');
    await expect(codeBlock.first()).toBeVisible();
  });

  test('code block has copy button', async ({ page }) => {
    // Should have a Copy button
    const copyButton = page.getByLabel('Copy code to clipboard');
    await expect(copyButton.first()).toBeVisible();
  });

  test('table renders as HTML table', async ({ page }) => {
    // Should have a proper <table> element
    const table = page.locator('main table');
    await expect(table).toBeVisible();

    // Should contain the data
    await expect(table.getByText('Alpha')).toBeVisible();
    await expect(table.getByText('Beta')).toBeVisible();
  });

  test('task list checkboxes are visible', async ({ page }) => {
    // Should have checkbox inputs
    const checkboxes = page.locator('main input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(3);

    // The second checkbox (Completed task) should be checked
    await expect(checkboxes.nth(1)).toBeChecked();

    // The first and third should be unchecked
    await expect(checkboxes.nth(0)).not.toBeChecked();
    await expect(checkboxes.nth(2)).not.toBeChecked();
  });

  test('external link has target=_blank', async ({ page }) => {
    const externalLink = page.locator('a[href="https://example.com"]');
    await expect(externalLink).toBeVisible();
    await expect(externalLink).toHaveAttribute('target', '_blank');
  });

  test('mermaid diagram renders as SVG', async ({ page }) => {
    // Navigate to guide.md which has a mermaid diagram
    const sidebar = page.locator('aside');
    await sidebar.getByText('guide.md').click();

    // Wait for mermaid to render — it's async and uses lazy loading
    // The MermaidBlock component renders the SVG via dangerouslySetInnerHTML
    const mermaidSvg = page.locator('main .markdown-body svg');
    await expect(mermaidSvg.first()).toBeVisible({ timeout: 15_000 });
  });
});
