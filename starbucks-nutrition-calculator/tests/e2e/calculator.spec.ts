import { test, expect } from '@playwright/test';

test.describe('Calculator critical path', () => {
  test('select drink, change size/milk/syrup, read nutrition, reset, recalculate', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Calculate My Drink' }).first().click();

    const calculator = page.locator('#calculator');
    await expect(calculator).toBeVisible();

    // Step 1: choose a drink
    await page.getByPlaceholder('Search Starbucks drinks...').fill('latte');
    await page
      .getByRole('button', { name: /Caffè Latte/ })
      .first()
      .click();

    // Step 2: change size
    const grandeRadio = calculator.locator('input[name="size"][value="grande"]');
    await grandeRadio.check({ force: true });

    // Step 3: change milk
    const oatRadio = calculator.locator('input[name="milk"][value="oat"]');
    if (await oatRadio.count()) {
      await oatRadio.check({ force: true });
    }

    // Add a syrup pump - should surface an "unavailable" note, not a fabricated number
    const increaseSyrup = calculator.getByRole('button', { name: /Increase flavored syrup/i });
    if (await increaseSyrup.count()) {
      await increaseSyrup.click();
      await expect(calculator.getByText(/unavailable/i).first()).toBeVisible();
    }

    // Step 4: read nutrition
    const calories = calculator.locator('.nutrition-panel__calories-value');
    await expect(calories).toBeVisible();
    const firstReading = await calories.textContent();
    expect(firstReading?.trim().length).toBeGreaterThan(0);

    // Change size again and confirm nutrition updates without going stale
    const shortRadio = calculator.locator('input[name="size"][value="short"]');
    if ((await shortRadio.count()) && !(await shortRadio.isDisabled())) {
      await shortRadio.check({ force: true });
      await expect(calories).not.toHaveText(firstReading ?? '');
    }

    // Reset
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(calculator.locator('.nutrition-panel__calories-value')).toBeVisible();

    // Recalculate should not throw and should keep a value displayed
    await page.getByRole('button', { name: 'Recalculate' }).click();
    await expect(calories).toBeVisible();
  });

  test('no drinks found state appears for a nonsense query and clears cleanly', async ({ page }) => {
    await page.goto('/#calculator');
    await page.getByPlaceholder('Search Starbucks drinks...').fill('zzzznotadrink');
    await expect(page.getByText('No drinks found')).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByText('No drinks found')).toHaveCount(0);
  });
});
