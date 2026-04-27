import { test, expect } from '@playwright/test';

test.describe('values-auction smoke', () => {
  test('facilitator, participant, and wall render', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();

    const facilitator = await ctx1.newPage();
    const participant = await ctx2.newPage();
    const wall = await ctx3.newPage();

    const base = 'http://localhost:5173';

    await facilitator.goto(`${base}/#/facilitate?code=E2E`);
    await participant.goto(`${base}/#/join?code=E2E`);
    await wall.goto(`${base}/#/wall?code=E2E`);

    await expect(facilitator.locator('text=act timeline')).toBeVisible({ timeout: 10_000 });
    await expect(participant.locator('text=welcome')).toBeVisible({ timeout: 10_000 });
    await expect(wall).toHaveTitle(/values auction/);

    await ctx1.close();
    await ctx2.close();
    await ctx3.close();
  });
});
