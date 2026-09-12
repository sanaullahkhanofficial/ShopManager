import { test, expect } from '@playwright/test';

test.describe('Compare tool', () => {
  test('lets a user pick two drinks and see a nutrition difference', async ({ page }) => {
    await page.goto('/compare/');

    const table = page.locator('.compare-table');
    await expect(table).toBeVisible();

    const drinkASelect = page.locator('#compare-drink-Drink\\ A');
    await drinkASelect.selectOption({ label: 'Caffè Mocha' });

    const caloriesRow = table.locator('tbody tr').first();
    await expect(caloriesRow.locator('td').nth(1)).toHaveText(/370/);

    // URL should reflect the selection for sharing/deep-linking.
    await expect(page).toHaveURL(/aDrink=caffe-mocha/);
  });
});
