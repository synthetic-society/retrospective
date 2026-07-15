import { expect, test } from '@playwright/test';
import { addCard, createSession, setSessionExpiry, waitForSessionRefetch } from './helpers';

test.describe('Session Expiry', () => {
  test('expiry date updates in localStorage after adding a card', async ({ page }) => {
    const sessionName = `Expiry Test ${Date.now()}`;
    const { id: sessionId } = await createSession(page, sessionName);

    // Set an artificially old expiry date (5 days from now) in localStorage
    const oldExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    await setSessionExpiry(page, sessionId, oldExpiry);

    // Verify the old expiry is set (should show "Expires in 5 days")
    await page.goto('/');
    await expect(page.getByText('Expires in 5 days')).toBeVisible();

    // Go back to the session and add a card (triggers expiry update)
    await page.goto(`/${sessionId}`);
    await expect(page.getByRole('heading', { name: sessionName })).toBeVisible();

    // Add a card - this triggers the database trigger to extend expiry
    await addCard(page, 'Test card for expiry');
    await expect(page.getByText('Test card for expiry')).toBeVisible();

    // Wait for the session query to be invalidated and refetched
    // The mutation's onSuccess invalidates the session query, which refetches and updates localStorage
    await waitForSessionRefetch(page, sessionId);

    // Navigate back to home
    await page.goto('/');

    // The expiry should now show ~30 days (the server extended it)
    // It should NOT show 5 days anymore
    await expect(page.getByText('Expires in 5 days')).not.toBeVisible();
    await expect(page.getByText(/Expires in (29|30) days/)).toBeVisible();
  });

  test('expiry date updates after voting', async ({ page }) => {
    const sessionName = `Vote Expiry Test ${Date.now()}`;
    const { id: sessionId } = await createSession(page, sessionName);

    // Add a card first (this will update expiry to ~30 days)
    await addCard(page, 'Card to vote on');
    await expect(page.getByText('Card to vote on')).toBeVisible();

    // Wait for session refetch after adding card
    await waitForSessionRefetch(page, sessionId);

    // Now set an old expiry date AFTER the card was added
    const oldExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await setSessionExpiry(page, sessionId, oldExpiry);

    // Verify the old expiry is set by navigating to home
    await page.goto('/');
    await expect(page.getByText('Expires in 7 days')).toBeVisible();

    // Go back and vote (this should trigger another expiry update)
    await page.goto(`/${sessionId}`);
    await expect(page.getByRole('heading', { name: sessionName })).toBeVisible();

    // Click vote button
    const voteButton = page.getByRole('button', { name: /vote/i }).first();
    const voteResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/cards/') && resp.url().includes('/vote'),
    );
    await voteButton.click();
    await voteResponsePromise;

    // Wait for session refetch after voting
    await waitForSessionRefetch(page, sessionId);

    // Navigate back to home
    await page.goto('/');

    // Expiry should be extended to ~30 days
    await expect(page.getByText('Expires in 7 days')).not.toBeVisible();
    await expect(page.getByText(/Expires in (29|30) days/)).toBeVisible();
  });

  test('home page updates expiry when tab becomes visible', async ({ page, context }) => {
    const sessionName = `Visibility Test ${Date.now()}`;
    const { id: sessionId } = await createSession(page, sessionName);

    // Set an old expiry
    const oldExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    await setSessionExpiry(page, sessionId, oldExpiry);

    // Go to home, verify old expiry
    await page.goto('/');
    await expect(page.getByText('Expires in 10 days')).toBeVisible();

    // Open a new tab to the session and add a card
    const newPage = await context.newPage();
    await newPage.goto(`/${sessionId}`);
    await expect(newPage.getByRole('heading', { name: sessionName })).toBeVisible();

    await addCard(newPage, 'Card from other tab');
    await expect(newPage.getByText('Card from other tab')).toBeVisible();

    // Wait for session refetch in the new tab
    await waitForSessionRefetch(newPage, sessionId);

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
