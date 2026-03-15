import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ request }) => {
    // Clear any persisted tabs from previous test runs
    await request.patch('/api/state', {
      data: { openTabs: [] },
    });
  });

  test('app loads and shows sidebar with project', async ({ page }) => {
    await page.goto('/');

    // Sidebar should show the project name "test-docs"
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('test-docs')).toBeVisible();
  });

  test('expand project shows files', async ({ page }) => {
    await page.goto('/');

    // Click the project name to expand it
    const sidebar = page.locator('aside');
    await sidebar.getByText('test-docs').click();

    // Should see both markdown files
    await expect(sidebar.getByText('README.md')).toBeVisible();
    await expect(sidebar.getByText('guide.md')).toBeVisible();
  });

  test('click file opens it in a tab with rendered content', async ({
    page,
  }) => {
    await page.goto('/');

    // Expand project
    const sidebar = page.locator('aside');
    await sidebar.getByText('test-docs').click();

    // Click README.md
    await sidebar.getByText('README.md').click();

    // Should render the heading "Test Project" in the content area
    const main = page.locator('main');
    await expect(main.locator('h1', { hasText: 'Test Project' })).toBeVisible();

    // Tab should appear in the tab bar
    const tabBar = main.locator('[role="tablist"]');
    await expect(tabBar.getByText('README.md')).toBeVisible();
  });

  test('clicking a markdown link opens a new tab', async ({ page }) => {
    await page.goto('/');

    // Expand project and open README
    const sidebar = page.locator('aside');
    await sidebar.getByText('test-docs').click();
    await sidebar.getByText('README.md').click();

    // Wait for content to load
    const main = page.locator('main');
    await expect(main.locator('h1', { hasText: 'Test Project' })).toBeVisible();

    // Click the "See the guide" link
    await main.getByText('See the guide').click();

    // guide.md should now be the active tab and show its heading
    await expect(main.locator('h1', { hasText: 'Guide' })).toBeVisible();

    // Both tabs should be visible in the tab bar
    const tabBar = main.locator('[role="tablist"]');
    await expect(tabBar.getByText('README.md')).toBeVisible();
    await expect(tabBar.getByText('guide.md')).toBeVisible();
  });

  test('close a tab removes it while other tab remains', async ({ page }) => {
    await page.goto('/');

    // Open both files
    const sidebar = page.locator('aside');
    await sidebar.getByText('test-docs').click();
    await sidebar.getByText('README.md').click();

    const main = page.locator('main');
    await expect(main.locator('h1', { hasText: 'Test Project' })).toBeVisible();

    // Open guide via link
    await main.getByText('See the guide').click();
    await expect(main.locator('h1', { hasText: 'Guide' })).toBeVisible();

    const tabBar = main.locator('[role="tablist"]');

    // Close README.md tab using the close button
    const readmeTab = tabBar.locator('[role="tab"]').filter({ hasText: 'README.md' });
    const closeButton = readmeTab.getByLabel('Close README.md');
    // Force click because the close button is hidden until hover
    await closeButton.click({ force: true });

    // README.md tab should be gone
    await expect(tabBar.getByText('README.md')).not.toBeVisible();

    // guide.md tab should still be there
    await expect(tabBar.getByText('guide.md')).toBeVisible();
  });
});
