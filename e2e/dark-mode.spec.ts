import { test, expect } from '@playwright/test';

test.describe('Dark Mode', () => {
  test('theme toggle switches between light and dark mode', async ({
    page,
  }) => {
    await page.goto('/');

    const html = page.locator('html');

    // Determine the initial theme state
    const initiallyDark = await html.evaluate((el) =>
      el.classList.contains('dark'),
    );

    // Find the theme toggle button (it has an aria-label describing the switch)
    const themeToggle = page.getByLabel(/Switch to (dark|light) mode/);
    await expect(themeToggle).toBeVisible();

    // Click once to toggle
    await themeToggle.click();

    if (initiallyDark) {
      // Was dark, should now be light
      await expect(html).not.toHaveClass(/dark/);
    } else {
      // Was light, should now be dark
      await expect(html).toHaveClass(/dark/);
    }

    // Verify background color changed — in dark mode it should not be white
    const bgColor = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor,
    );
    if (!initiallyDark) {
      // Now in dark mode, background should not be pure white
      expect(bgColor).not.toBe('rgb(255, 255, 255)');
    }

    // Click again to toggle back
    await page.getByLabel(/Switch to (dark|light) mode/).click();

    if (initiallyDark) {
      // Back to dark
      await expect(html).toHaveClass(/dark/);
    } else {
      // Back to light
      await expect(html).not.toHaveClass(/dark/);
    }
  });
});
