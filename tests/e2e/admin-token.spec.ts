import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { createSession } from './helpers';

test.describe('Admin Token', () => {
  test('session list shows "Recent sessions" header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Recent sessions')).toBeVisible();
  });

  test('created session appears in list with expiration info', async ({ page }) => {
    const sessionName = `Expiry Test ${Date.now()}`;
    await createSession(page, sessionName);

    // Go back to home page
    await page.goto('/');

    // Session should be in the list
    await expect(page.getByText(sessionName)).toBeVisible();

    // Should show expiration info (e.g., "Expires in 30 days")
    await expect(page.getByText(/Expires in \d+ days/)).toBeVisible();
  });

  test('delete button is visible for sessions user created', async ({ page }) => {
    const sessionName = `Delete Button Test ${Date.now()}`;
    await createSession(page, sessionName);

    // Go back to home page
    await page.goto('/');

    // Delete button should be visible for the session we created
    const sessionItem = page.locator('a', { hasText: sessionName });
    await expect(sessionItem.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('delete button opens confirmation popup', async ({ page }) => {
    const sessionName = `Popup Test ${Date.now()}`;
    await createSession(page, sessionName);

    await page.goto('/');

    // Click delete button
    const sessionItem = page.locator('a', { hasText: sessionName });
    await sessionItem.getByRole('button', { name: 'Delete' }).click();

    // Confirmation popup should appear
    await expect(page.getByRole('heading', { name: 'Delete Session?' })).toBeVisible();
    await expect(page.getByText('This will permanently delete the session')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' }).last()).toBeVisible();
  });

  test('cancel button closes popup without deleting', async ({ page }) => {
    const sessionName = `Cancel Test ${Date.now()}`;
    await createSession(page, sessionName);

    await page.goto('/');

    // Click delete, then cancel
    const sessionItem = page.locator('a', { hasText: sessionName });
    await sessionItem.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Popup should close
    await expect(page.getByRole('heading', { name: 'Delete Session?' })).not.toBeVisible();

    // Session should still be in the list
    await expect(page.getByText(sessionName)).toBeVisible();
  });

  test('confirm delete removes session from list and database', async ({ page }) => {
    const sessionName = `Confirm Delete Test ${Date.now()}`;
    const { id: sessionId } = await createSession(page, sessionName);

    await page.goto('/');

    // Click delete, then confirm
    const sessionItem = page.locator('a', { hasText: sessionName });
    await sessionItem.getByRole('button', { name: 'Delete' }).click();

    // Wait for delete API call
    const deletePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/sessions/') && resp.request().method() === 'DELETE',
    );
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await deletePromise;

    // Popup should close
    await expect(page.getByRole('heading', { name: 'Delete Session?' })).not.toBeVisible();

    // Session should be removed from the list
    await expect(page.getByText(sessionName)).not.toBeVisible();

    // Verify session is deleted from database via API
    const response = await page.request.get(`/api/sessions/${sessionId}`);
    expect(response.status()).toBe(404);
  });
});

test.describe('Admin Token - Multi-user', () => {
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let userA: Page;
  let userB: Page;

  test.beforeEach(async ({ browser }) => {
    contextA = await browser.newContext();
    contextB = await browser.newContext();
    userA = await contextA.newPage();
    userB = await contextB.newPage();
  });

  test.afterEach(async () => {
    await contextA.close();
    await contextB.close();
  });

  test('user without admin token cannot see delete button', async () => {
    // User A creates a session
    const sessionName = `No Delete ${Date.now()}`;
    await createSession(userA, sessionName);

    // User A goes home - should see their session WITH delete button
    await userA.goto('/');
    const userASessionItem = userA.locator('a', { hasText: sessionName });
    await expect(userASessionItem).toBeVisible();
    await expect(userASessionItem.getByRole('button', { name: 'Delete' })).toBeVisible();

    // User B goes home - should NOT see User A's session (they didn't create it)
    await userB.goto('/');
    const userBSessionItem = userB.locator('a', { hasText: sessionName });
    await expect(userBSessionItem).not.toBeVisible();
  });

  test('only creator can delete session via API', async () => {
    // User A creates a session
    const sessionName = `API Delete ${Date.now()}`;
    const { url: sessionUrl, id: sessionId } = await createSession(userA, sessionName);

    // User B tries to delete via API with a wrong admin token (valid UUID format, but incorrect)
    const fakeToken = '00000000-0000-0000-0000-000000000000';
    const response = await userB.request.delete(`/api/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${fakeToken}` },
    });
    expect(response.status()).toBe(403);

    // Session should still exist - User A can access it
    await userA.goto(sessionUrl);
    await expect(userA.getByRole('heading', { name: sessionName })).toBeVisible();
  });

  test('delete API returns 403 without admin token', async () => {
    // User A creates a session
    const sessionName = `No Token ${Date.now()}`;
    const { id: sessionId } = await createSession(userA, sessionName);

    // Astro now rejects a cross-site-style state-changing request before it reaches endpoint validation.
    const response = await userA.request.delete(`/api/sessions/${sessionId}`);
    expect(response.status()).toBe(403);
  });
});
