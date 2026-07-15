import { expect, test } from '@playwright/test';
import { addCard, clickVote, createSession } from './helpers';

test.describe('Voting', () => {
  test('can create session, add card, and toggle votes', async ({ page }) => {
    const sessionName = `Test Session ${Date.now()}`;
    await createSession(page, sessionName);

    // Add a card
    const cardContent = `Test card ${Date.now()}`;
    await addCard(page, cardContent);
    await expect(page.getByRole('button', { name: `Edit card: ${cardContent}` })).toBeVisible();

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
    await expect(page.getByRole('button', { name: 'Edit card: Card A' })).toBeVisible();
    await addCard(page, 'Card B');
    await expect(page.getByRole('button', { name: 'Edit card: Card B' })).toBeVisible();
    await addCard(page, 'Card C');
    await expect(page.getByRole('button', { name: 'Edit card: Card C' })).toBeVisible();

    // Verify initial order: Card A (0), Card B (1), Card C (2) - all have 0 votes
    // All cards have text visible (use role to avoid matching live region)
    await expect(page.getByRole('button', { name: 'Edit card: Card A' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit card: Card B' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit card: Card C' })).toBeVisible();

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
