import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { addCard, createSession } from './helpers';

test.describe('Accessibility', () => {
  test('home page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('session page has no accessibility violations', async ({ page }) => {
    const sessionName = `A11y Test ${Date.now()}`;
    await createSession(page, sessionName);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('session page with cards has no accessibility violations', async ({ page }) => {
    const sessionName = `A11y Cards Test ${Date.now()}`;
    await createSession(page, sessionName);

    // Add some cards to test more UI elements
    await addCard(page, 'Test card for accessibility');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('add card form has no accessibility violations', async ({ page }) => {
    const sessionName = `A11y Form Test ${Date.now()}`;
    await createSession(page, sessionName);

    // Open the add card form
    await page.getByText("I'm glad that…").click();
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('fullscreen dialog has no accessibility violations', async ({ page }) => {
    const sessionName = `A11y Fullscreen ${Date.now()}`;
    await createSession(page, sessionName);
    await addCard(page, 'Fullscreen a11y test');

    // Open fullscreen view
    await page.getByRole('button', { name: 'View What went well fullscreen' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

    expect(results.violations).toEqual([]);
  });

  test('delete confirmation dialog has no accessibility violations', async ({ page }) => {
    const sessionName = `A11y Delete ${Date.now()}`;
    await createSession(page, sessionName);

    // Go back to home to see the session list
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click delete on the session we created
    const deleteButton = page.getByRole('button', { name: 'Delete' }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await expect(page.getByRole('alertdialog')).toBeVisible();

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

      expect(results.violations).toEqual([]);

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click();
    }
  });

  test('reduced motion disables animations and doodly filter', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify --doodly-filter is none
    const filterValue = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--doodly-filter').trim(),
    );
    expect(filterValue).toBe('none');
  });
});
