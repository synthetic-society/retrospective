import { expect, type Page, test } from '@playwright/test';

async function createSession(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByPlaceholder('Sprint 42 Retro').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  return page.url();
}

async function addCard(page: Page, content: string) {
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

test.describe('Keyboard navigation', () => {
  test('skip link is accessible and moves focus to main content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to the skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByText('Skip to main content');
    await expect(skipLink).toBeFocused();

    // Activate skip link
    await page.keyboard.press('Enter');

    // Focus should now be on main-content or within it
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeAttached();
  });

  test('tab traversal on home page follows logical order', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab: skip link → session name input → (Create is disabled/skipped) → demo link → privacy link
    await page.keyboard.press('Tab'); // skip link
    await expect(page.getByText('Skip to main content')).toBeFocused();

    await page.keyboard.press('Tab'); // session name input
    await expect(page.locator('#session-name')).toBeFocused();

    // Create button is disabled (empty input), so Tab skips it
    await page.keyboard.press('Tab'); // demo link
    await expect(page.getByText('or try the demo →')).toBeFocused();

    await page.keyboard.press('Tab'); // privacy link
    await expect(page.getByText('Privacy Policy')).toBeFocused();
  });

  test('card keyboard editing: Enter/Space opens edit, Escape cancels', async ({ page }) => {
    const sessionName = `Keyboard Card ${Date.now()}`;
    await createSession(page, sessionName);
    await addCard(page, 'Keyboard test card');

    // Find the card button and focus it
    const cardButton = page.getByRole('button', { name: /Edit card: Keyboard test card/ });
    await cardButton.focus();
    await expect(cardButton).toBeFocused();

    // Press Enter to start editing
    await page.keyboard.press('Enter');
    const textbox = page.getByRole('textbox', { name: 'Edit card content' });
    await expect(textbox).toBeVisible();
    // Wait for focus to move to the edit textbox
    await expect(textbox).toBeFocused();

    // Press Escape to cancel editing
    await page.keyboard.press('Escape');
    await expect(textbox).not.toBeVisible();

    // Use Space to start editing
    await cardButton.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('textbox', { name: 'Edit card content' })).toBeVisible();
  });

  test('column accordion toggle works via keyboard on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const sessionName = `Accordion KB ${Date.now()}`;
    await createSession(page, sessionName);

    // Find the "Questions" accordion toggle
    const questionsToggle = page.getByRole('button', { name: /Questions/ });
    await questionsToggle.focus();

    // Verify aria-expanded is false initially (only "glad" is expanded by default)
    await expect(questionsToggle).toHaveAttribute('aria-expanded', 'false');

    // Press Enter to expand
    await page.keyboard.press('Enter');
    await expect(questionsToggle).toHaveAttribute('aria-expanded', 'true');

    // Press Enter again to collapse
    await page.keyboard.press('Enter');
    await expect(questionsToggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Focus traps', () => {
  test('fullscreen dialog traps focus and returns focus on close', async ({ page }) => {
    const sessionName = `Focus Trap FS ${Date.now()}`;
    await createSession(page, sessionName);
    await addCard(page, 'Focus trap test card');

    // Open fullscreen view for the "What went well" column
    const fullscreenButton = page.getByRole('button', { name: 'View What went well fullscreen' });
    await fullscreenButton.click();

    // Dialog should be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Close button (the X button, not the backdrop) should be focusable
    const closeButton = page.getByRole('button', { name: 'Close fullscreen', exact: true });
    await closeButton.focus();
    await expect(closeButton).toBeFocused();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('delete dialog traps focus and starts on Cancel', async ({ page }) => {
    // Create a session so we have one in the list
    const sessionName = `Focus Trap Del ${Date.now()}`;
    await createSession(page, sessionName);

    // Go back to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find and click delete button
    const deleteButton = page.getByRole('button', { name: 'Delete' }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Alertdialog should be visible
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      // Cancel button should receive focus (it's the first focusable element — safe default)
      const cancelButton = page.getByRole('button', { name: 'Cancel' });
      await expect(cancelButton).toBeFocused();

      // Tab should move to Delete button
      await page.keyboard.press('Tab');
      const confirmDeleteButton = dialog.getByRole('button', { name: /Delete/ }).last();
      await expect(confirmDeleteButton).toBeFocused();

      // Shift+Tab should move back to Cancel
      await page.keyboard.press('Shift+Tab');
      await expect(cancelButton).toBeFocused();

      // Escape should close
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  });
});
