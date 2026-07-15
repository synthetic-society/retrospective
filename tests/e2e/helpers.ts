import { expect, type Page } from '@playwright/test';

// Create a session and navigate to it. Returns the session URL and id.
export async function createSession(page: Page, name: string): Promise<{ url: string; id: string }> {
  await page.goto('/');
  await page.getByPlaceholder('Sprint 42 Retro').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  const url = page.url();
  const id = url.split('/').pop();
  if (!id) throw new Error('Session ID not found in URL');
  return { url, id };
}

// Add a card to the "glad" column and wait for the form to close.
export async function addCard(page: Page, content: string) {
  await page.getByText("I'm glad that…").click();
  await page.getByRole('textbox').first().fill(content);
  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/sessions/') && resp.url().includes('/cards') && resp.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await responsePromise;
  await expect(page.getByRole('button', { name: 'Add', exact: true })).not.toBeVisible();
}

// Click a vote button and wait for the vote API response.
export async function clickVote(page: Page, voteButton: ReturnType<Page['getByRole']>) {
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/cards/') && resp.url().includes('/vote') && resp.request().method() === 'PATCH',
  );
  await voteButton.click();
  await responsePromise;
}

// Seed a session's expiry date in localStorage's retro_sessions list.
export async function setSessionExpiry(page: Page, sessionId: string, expiry: string) {
  await page.evaluate(
    ({ sessionId, expiry }) => {
      const sessions = JSON.parse(localStorage.getItem('retro_sessions') || '[]');
      const updated = sessions.map((s: { id: string }) => (s.id === sessionId ? { ...s, expires_at: expiry } : s));
      localStorage.setItem('retro_sessions', JSON.stringify(updated));
    },
    { sessionId, expiry },
  );
}

// Wait for the session GET query to refetch (invalidated after a mutation).
export function waitForSessionRefetch(page: Page, sessionId: string) {
  return page.waitForResponse(
    (resp) => resp.url().includes(`/api/sessions/${sessionId}`) && resp.request().method() === 'GET',
  );
}
