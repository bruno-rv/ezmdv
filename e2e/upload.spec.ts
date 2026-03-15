import { test, expect } from '@playwright/test';

test.describe('Upload Flow', () => {
  test('upload a markdown file and view it', async ({ page, request }) => {
    // Use a unique filename to avoid collisions with leftover state
    const uniqueId = Date.now().toString(36);
    const fileName = `test-${uniqueId}.md`;
    const projectName = `test-${uniqueId}`;
    const fileContent =
      '# Uploaded Document\n\nThis file was uploaded via Playwright.\n';

    // 1. Create a project via API (simulates the frontend's createProject call)
    const createRes = await request.post('/api/projects', {
      data: { name: projectName, path: '', source: 'upload' },
    });
    expect(createRes.ok()).toBeTruthy();
    const project = await createRes.json();

    // 2. Upload the file via API (simulates the frontend's uploadFiles call)
    const uploadRes = await request.post(
      `/api/projects/${project.id}/upload`,
      {
        multipart: {
          files: {
            name: fileName,
            mimeType: 'text/markdown',
            buffer: Buffer.from(fileContent),
          },
        },
      },
    );
    expect(uploadRes.ok()).toBeTruthy();

    // 3. Navigate to the app and verify the uploaded project appears
    await page.goto('/');

    const sidebar = page.locator('aside');

    // The project should be visible in the sidebar
    await expect(
      sidebar.getByText(projectName, { exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // Expand the project
    await sidebar.getByText(projectName, { exact: true }).click();

    // The uploaded file should be visible
    await expect(sidebar.getByText(fileName)).toBeVisible({
      timeout: 10_000,
    });

    // Click the file to view its content
    await sidebar.getByText(fileName).click();

    // Content should render
    const main = page.locator('main');
    await expect(
      main.locator('h1', { hasText: 'Uploaded Document' }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
