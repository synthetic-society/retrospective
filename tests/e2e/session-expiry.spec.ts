import { test, expect, type Page } from '@playwright/test';

// Helper to create a session and navigate to it
async function createSession(page: Page, name: string) {
  await page.goto('/');
  await page.getByPlaceholder('Sprint 42 Retro').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  // Return the session ID from the URL
  const url = page.url();
  return url.split('/').pop()!;
}

// Helper to add a card to the "glad" column
async function addCard(page: Page, content: string) {
  await page.getByText("I'm glad that…").click();
  await page.getByRole('textbox').first().fill(content);
  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/api/sessions/') && resp.url().includes('/cards') && resp.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Add' }).click();
  await responsePromise;
  await expect(page.getByRole('button', { name: 'Add' })).not.toBeVisible();
  await expect(page.getByText(content)).toBeVisible();
}

test.describe('Session Expiry', () => {
  test('expiry date updates in localStorage after adding a card', async ({ page }) => {
    const sessionName = `Expiry Test ${Date.now()}`;
    const sessionId = await createSession(page, sessionName);

    // Set an artificially old expiry date (5 days from now) in localStorage
    const oldExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    await page.evaluate(({ sessionId, oldExpiry }) => {
      const sessions = JSON.parse(localStorage.getItem('retro_sessions') || '[]');
      const updated = sessions.map((s: { id: string }) =>
        s.id === sessionId ? { ...s, expires_at: oldExpiry } : s
      );
      localStorage.setItem('retro_sessions', JSON.stringify(updated));
    }, { sessionId, oldExpiry });

    // Verify the old expiry is set (should show "Expires in 5 days")
    await page.goto('/');
    await expect(page.getByText('Expires in 5 days')).toBeVisible();

    // Go back to the session and add a card (triggers expiry update)
    await page.goto(`/${sessionId}`);
    await expect(page.getByRole('heading', { name: sessionName })).toBeVisible();

    // Add a card - this triggers the database trigger to extend expiry
    await addCard(page, 'Test card for expiry');

    // Wait for the session query to be invalidated and refetched
    // The mutation's onSuccess invalidates the session query, which refetches and updates localStorage
    await page.waitForResponse(
      resp => resp.url().includes(`/api/sessions/${sessionId}`) && resp.request().method() === 'GET'
    );

    // Navigate back to home
    await page.goto('/');

    // The expiry should now show ~30 days (the server extended it)
    // It should NOT show 5 days anymore
    await expect(page.getByText('Expires in 5 days')).not.toBeVisible();
    await expect(page.getByText(/Expires in (29|30) days/)).toBeVisible();
  });

  test('expiry date updates after voting', async ({ page }) => {
    const sessionName = `Vote Expiry Test ${Date.now()}`;
    const sessionId = await createSession(page, sessionName);

    // Add a card first (this will update expiry to ~30 days)
    await addCard(page, 'Card to vote on');

    // Wait for session refetch after adding card
    await page.waitForResponse(
      resp => resp.url().includes(`/api/sessions/${sessionId}`) && resp.request().method() === 'GET'
    );

    // Now set an old expiry date AFTER the card was added
    const oldExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await page.evaluate(({ sessionId, oldExpiry }) => {
      const sessions = JSON.parse(localStorage.getItem('retro_sessions') || '[]');
      const updated = sessions.map((s: { id: string }) =>
        s.id === sessionId ? { ...s, expires_at: oldExpiry } : s
      );
      localStorage.setItem('retro_sessions', JSON.stringify(updated));
    }, { sessionId, oldExpiry });

    // Verify the old expiry is set by navigating to home
    await page.goto('/');
    await expect(page.getByText('Expires in 7 days')).toBeVisible();

    // Go back and vote (this should trigger another expiry update)
    await page.goto(`/${sessionId}`);
    await expect(page.getByRole('heading', { name: sessionName })).toBeVisible();

    // Click vote button
    const voteButton = page.getByRole('button', { name: /vote/i }).first();
    const voteResponsePromise = page.waitForResponse(
      resp => resp.url().includes('/api/cards/') && resp.url().includes('/vote')
    );
    await voteButton.click();
    await voteResponsePromise;

    // Wait for session refetch after voting
    await page.waitForResponse(
      resp => resp.url().includes(`/api/sessions/${sessionId}`) && resp.request().method() === 'GET'
    );

    // Navigate back to home
    await page.goto('/');

    // Expiry should be extended to ~30 days
    await expect(page.getByText('Expires in 7 days')).not.toBeVisible();
    await expect(page.getByText(/Expires in (29|30) days/)).toBeVisible();
  });

  test('home page updates expiry when tab becomes visible', async ({ page, context }) => {
    const sessionName = `Visibility Test ${Date.now()}`;
    const sessionId = await createSession(page, sessionName);

    // Set an old expiry
    const oldExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    await page.evaluate(({ sessionId, oldExpiry }) => {
      const sessions = JSON.parse(localStorage.getItem('retro_sessions') || '[]');
      const updated = sessions.map((s: { id: string }) =>
        s.id === sessionId ? { ...s, expires_at: oldExpiry } : s
      );
      localStorage.setItem('retro_sessions', JSON.stringify(updated));
    }, { sessionId, oldExpiry });

    // Go to home, verify old expiry
    await page.goto('/');
    await expect(page.getByText('Expires in 10 days')).toBeVisible();

    // Open a new tab to the session and add a card
    const newPage = await context.newPage();
    await newPage.goto(`/${sessionId}`);
    await expect(newPage.getByRole('heading', { name: sessionName })).toBeVisible();

    await addCard(newPage, 'Card from other tab');

    // Wait for session refetch in the new tab
    await newPage.waitForResponse(
      resp => resp.url().includes(`/api/sessions/${sessionId}`) && resp.request().method() === 'GET'
    );

    // Close the new tab - this triggers visibilitychange on the original tab
    await newPage.close();

    // The original tab should update when it becomes visible
    // Trigger a visibilitychange by focusing the page
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Give it a moment to re-read localStorage
    await page.waitForTimeout(100);

    // Expiry should now show ~30 days
    await expect(page.getByText('Expires in 10 days')).not.toBeVisible();
    await expect(page.getByText(/Expires in (29|30) days/)).toBeVisible();
  });
});
