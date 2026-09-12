import type { NutritionDatabase } from '@/types/database';
import type { Drink } from '@/types/drink';
import type { NutritionFacts } from '@/types/nutrition';

export interface SmartSwapSuggestion {
  drink: Drink;
  label: string;
  currentValue: number;
  candidateValue: number;
}

function defaultNutrition(drink: Drink): NutritionFacts | null {
  const size = drink.sizes.find((s) => s.id === drink.defaultSizeId && s.available);
  return size?.nutrition ?? null;
}

/**
 * Suggests other drinks that are measurably better on one metric, using
 * neutral, non-health-judgment language. Only generated from real,
 * already-calculated default-recipe nutrition - never inferred.
 */
export function getSmartSwaps(currentDrinkId: string, currentNutrition: NutritionFacts, database: NutritionDatabase): SmartSwapSuggestion[] {
  const others = database.drinks.filter((d) => d.id !== currentDrinkId);
  const suggestions: SmartSwapSuggestion[] = [];

  function best(metric: keyof NutritionFacts, label: string, lowerIsBetter: boolean) {
    const current = currentNutrition[metric];
    if (current === null) return;
    let bestDrink: Drink | null = null;
    let bestValue = current;
    for (const drink of others) {
      const nutrition = defaultNutrition(drink);
      const value = nutrition?.[metric] ?? null;
      if (value === null) continue;
      const better = lowerIsBetter ? value < bestValue : value > bestValue;
      if (better) {
        bestValue = value;
        bestDrink = drink;
      }
    }
    if (bestDrink) suggestions.push({ drink: bestDrink, label, currentValue: current, candidateValue: bestValue });
  }

  best('calories', 'Lower-calorie option', true);
  best('sugarG', 'Lower-sugar option', true);
  best('proteinG', 'Higher-protein option', false);
  best('caffeineMg', 'Lower-caffeine option', true);

  const dairyFreeCandidate = others.find((d) => !d.allergens.includes('milk') && d.defaultMilkId === null);
  if (dairyFreeCandidate && database.drinks.find((d) => d.id === currentDrinkId)?.allergens.includes('milk')) {
    const nutrition = defaultNutrition(dairyFreeCandidate);
    if (nutrition?.calories !== null && nutrition?.calories !== undefined) {
      suggestions.push({ drink: dairyFreeCandidate, label: 'Dairy-free option', currentValue: 0, candidateValue: nutrition.calories });
    }
  }

  return suggestions;
}
