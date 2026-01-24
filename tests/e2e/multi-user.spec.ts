import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Helper to create a session and navigate to it
async function createSession(page: Page, name: string) {
  await page.goto('/');
  await page.getByPlaceholder('Sprint 42 Retro').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

// Helper to add a card to the "glad" column
async function addCard(page: Page, content: string) {
  await page.getByText("I'm glad that…").click();
  await page.getByRole('textbox').first().fill(content);

  // Wait for the API response when adding
  const responsePromise = page.waitForResponse(resp =>
    resp.url().includes('/api/sessions/') && resp.url().includes('/cards') && resp.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Add' }).click();
  await responsePromise;

  // Wait for the "Add" button to disappear (form closes after adding)
  await expect(page.getByRole('button', { name: 'Add' })).not.toBeVisible();
  // And the card text should be visible somewhere on the page
  await expect(page.getByText(content)).toBeVisible();
}

// Helper to click vote and wait for API response
async function clickVote(page: Page, voteButton: ReturnType<Page['getByRole']>) {
  const responsePromise = page.waitForResponse(resp =>
    resp.url().includes('/api/cards/') && resp.url().includes('/vote') && resp.request().method() === 'PATCH'
  );
  await voteButton.click();
  await responsePromise;
}

// Helper to reload and wait for API data to load
async function reloadAndWait(page: Page) {
  // Wait a moment to ensure cache expires (API has 1s stale-while-revalidate)
  await page.waitForTimeout(1100);

  // Wait for both cards and votes API calls after reload
  const cardsPromise = page.waitForResponse(resp =>
    resp.url().includes('/api/sessions/') && resp.url().includes('/cards') && resp.request().method() === 'GET'
  );
  const votesPromise = page.waitForResponse(resp =>
    resp.url().includes('/api/sessions/') && resp.url().includes('/votes') && resp.request().method() === 'GET'
  );
  await page.reload();
  await Promise.all([cardsPromise, votesPromise]);
}

test.describe('Multi-user voting', () => {
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let userA: Page;
  let userB: Page;
  let sessionUrl: string;

  test.beforeEach(async ({ browser }) => {
    // Create two isolated browser contexts (simulating two different users)
    contextA = await browser.newContext();
    contextB = await browser.newContext();
    userA = await contextA.newPage();
    userB = await contextB.newPage();
  });

  test.afterEach(async () => {
    await contextA.close();
    await contextB.close();
  });

  test('votes sync between different users', async () => {
    // User A creates a session
    const sessionName = `Multi-user Test ${Date.now()}`;
    await createSession(userA, sessionName);
    sessionUrl = userA.url();

    // User A adds a card
    const cardContent = `Shared card ${Date.now()}`;
    await addCard(userA, cardContent);

    // User B joins the same session
    await userB.goto(sessionUrl);
    await expect(userB.getByRole('heading', { name: sessionName })).toBeVisible();

    // Wait for User B's page to fully load
    await expect(userB.getByText(cardContent)).toBeVisible();

    // Get vote buttons for both users
    const voteButtonA = userA.getByRole('button', { name: /vote/i }).first();
    const voteButtonB = userB.getByRole('button', { name: /vote/i }).first();

    // Both users see 0 votes initially
    await expect(voteButtonA).toContainText('0');
    await expect(voteButtonB).toContainText('0');

    // User A votes
    await clickVote(userA, voteButtonA);
    await expect(voteButtonA).toContainText('1');

    // User B refreshes and should see the updated vote count
    // Use polling approach since data may take a moment to sync
    await expect(async () => {
      await userB.reload();
      await expect(userB.getByRole('button', { name: /vote/i }).first()).toContainText('1');
    }).toPass({ timeout: 10000 });

    // User B also votes (this is a different vote since they have different voter_id)
    await clickVote(userB, userB.getByRole('button', { name: /vote/i }).first());
    await expect(userB.getByRole('button', { name: /vote/i }).first()).toContainText('2');

    // User A refreshes and should see 2 votes
    await reloadAndWait(userA);
    await expect(userA.getByRole('button', { name: /vote/i }).first()).toContainText('2');
  });

  test('each user can only vote once per card', async () => {
    // User A creates a session
    const sessionName = `Single Vote Test ${Date.now()}`;
    await createSession(userA, sessionName);
    sessionUrl = userA.url();

    // User A adds a card and votes
    const cardContent = `Vote once ${Date.now()}`;
    await addCard(userA, cardContent);

    const voteButtonA = userA.getByRole('button', { name: /vote/i }).first();

    // User A votes
    await clickVote(userA, voteButtonA);
    await expect(voteButtonA).toContainText('1');
    await expect(voteButtonA).toHaveAttribute('aria-pressed', 'true');

    // User A clicks again - should toggle off (unvote)
    await clickVote(userA, voteButtonA);
    await expect(voteButtonA).toContainText('0');
    await expect(voteButtonA).toHaveAttribute('aria-pressed', 'false');

    // User A votes again
    await clickVote(userA, voteButtonA);
    await expect(voteButtonA).toContainText('1');

    // User B joins and votes
    await userB.goto(sessionUrl);
    await expect(userB.getByText(cardContent)).toBeVisible();
    const voteButtonB = userB.getByRole('button', { name: /vote/i }).first();

    // User B sees 1 vote (from User A)
    await expect(voteButtonB).toContainText('1');

    // User B's vote button should NOT be pressed (they haven't voted)
    await expect(voteButtonB).toHaveAttribute('aria-pressed', 'false');

    // User B votes
    await clickVote(userB, voteButtonB);
    await expect(voteButtonB).toContainText('2');
    await expect(voteButtonB).toHaveAttribute('aria-pressed', 'true');

    // User A refreshes - still sees 2 votes and their vote is still active
    // Use polling approach since data may take a moment to sync
    await expect(async () => {
      await userA.reload();
      const refreshedVoteButtonA = userA.getByRole('button', { name: /vote/i }).first();
      await expect(refreshedVoteButtonA).toContainText('2');
      await expect(refreshedVoteButtonA).toHaveAttribute('aria-pressed', 'true');
    }).toPass({ timeout: 10000 });
  });
});
