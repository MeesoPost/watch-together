// Placeholder for Playwright E2E tests
// Install: npx playwright install
// Run: npx playwright test

import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page.locator('h1')).toContainText('Watch Together');
});

test('can navigate to create party', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("Create Party")');
  await expect(page).toHaveURL(/\/create/);
});
