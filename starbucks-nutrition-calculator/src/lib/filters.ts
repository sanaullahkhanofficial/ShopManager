import type { Drink } from '@/types/drink';

export type FilterId = 'under-200-cal' | 'low-sugar' | 'high-protein' | 'dairy-free' | 'caffeine-free';

export interface FilterDef {
  id: FilterId;
  label: string;
  description: string;
}

export const QUICK_FILTERS: FilterDef[] = [
  { id: 'under-200-cal', label: 'Under 200 Calories', description: 'Default recipe at its default size is under 200 kcal.' },
  { id: 'low-sugar', label: 'Low Sugar', description: 'Default recipe has 10g of sugar or less.' },
  { id: 'high-protein', label: 'High Protein', description: 'Default recipe has 10g of protein or more.' },
  { id: 'dairy-free', label: 'Dairy Free', description: 'Not made with dairy milk by default and does not list milk as an allergen.' },
  { id: 'caffeine-free', label: 'Caffeine Free', description: 'Default recipe has 0mg caffeine.' },
];

function defaultSizeNutrition(drink: Drink) {
  return drink.sizes.find((s) => s.id === drink.defaultSizeId) ?? drink.sizes[0];
}

/** Every filter queries the live drink data - there is no hard-coded drink list here. */
export function applyFilter(filterId: FilterId, drinks: Drink[]): Drink[] {
  return drinks.filter((drink) => {
    const size = defaultSizeNutrition(drink);
    if (!size) return false;
    const n = size.nutrition;
    switch (filterId) {
      case 'under-200-cal':
        return n.calories !== null && n.calories < 200;
      case 'low-sugar':
        return n.sugarG !== null && n.sugarG <= 10;
      case 'high-protein':
        return n.proteinG !== null && n.proteinG >= 10;
      case 'dairy-free':
        return !drink.allergens.includes('milk') && drink.defaultMilkId === null;
      case 'caffeine-free':
        return n.caffeineMg !== null && n.caffeineMg === 0;
      default:
        return false;
    }
  });
}
