import { test, expect } from '@playwright/test';

test('test basic', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: 'Login now' }).click();
  await page.getByRole('button', { name: 'Availabilities' }).click();
  await page.getByRole('button', { name: 'Expand' }).first().click();
  await page.getByRole('button', { name: 'Today' }).click();
  await page.getByRole('button').nth(3).click();
  await page.getByRole('button', { name: '+5d' }).click();
});
