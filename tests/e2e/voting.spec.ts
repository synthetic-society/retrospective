import { test, expect, type Page } from '@playwright/test';

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
  // Click the placeholder to open the add card form
  await page.getByText("I'm glad that…").click();
  // Type content and submit
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

test.describe('Voting', () => {
  test('can create session, add card, and toggle votes', async ({ page }) => {
    const sessionName = `Test Session ${Date.now()}`;
    await createSession(page, sessionName);

    // Add a card
    const cardContent = `Test card ${Date.now()}`;
    await addCard(page, cardContent);

    // Find the vote button (look for button with aria-label containing "vote")
    const voteButton = page.getByRole('button', { name: /vote/i }).first();

    // Initial vote count should be 0
    await expect(voteButton).toContainText('0');

    // Click to vote
    await clickVote(page, voteButton);

    // Vote count should increase to 1
    await expect(voteButton).toContainText('1');

    // The heart should be filled (has fill-sketch-dark class)
    const heartSvg = voteButton.locator('svg');
    await expect(heartSvg).toHaveClass(/fill-sketch-dark/);

    // Button should be pressed
    await expect(voteButton).toHaveAttribute('aria-pressed', 'true');

    // Click again to unvote
    await clickVote(page, voteButton);

    // Vote count should decrease back to 0
    await expect(voteButton).toContainText('0');

    // Heart should be unfilled
    await expect(heartSvg).toHaveClass(/fill-none/);

    // Button should not be pressed
    await expect(voteButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('cards are sorted by vote count', async ({ page }) => {
    const sessionName = `Sort Test ${Date.now()}`;
    await createSession(page, sessionName);

    // Add three cards
    await addCard(page, 'Card A');
    await addCard(page, 'Card B');
    await addCard(page, 'Card C');

    // Verify initial order: Card A (0), Card B (1), Card C (2) - all have 0 votes
    // All cards have text visible
    await expect(page.getByText('Card A')).toBeVisible();
    await expect(page.getByText('Card B')).toBeVisible();
    await expect(page.getByText('Card C')).toBeVisible();

    // Get all vote buttons
    const voteButtons = page.getByRole('button', { name: /vote/i });

    // Vote on Card C (the third card, index 2)
    await clickVote(page, voteButtons.nth(2));

    // After voting and sorting, Card C should be at the top
    // The first vote button should now show 1 (Card C moved to top)
    await expect(voteButtons.first()).toContainText('1');

    // The other cards should have 0 votes
    await expect(voteButtons.nth(1)).toContainText('0');
    await expect(voteButtons.nth(2)).toContainText('0');
  });
});
