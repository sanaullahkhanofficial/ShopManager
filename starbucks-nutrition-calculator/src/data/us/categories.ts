import type { DrinkCategory } from '@/types/drink';

export interface CategoryMeta {
  id: DrinkCategory;
  name: string;
  description: string;
}

/**
 * Only categories with at least one drink in the current dataset should be
 * exposed in navigation - see getActiveCategories() in lib/catalog.ts, which
 * filters this list against the live drink data instead of hard-coding it.
 */
export const ALL_CATEGORIES: CategoryMeta[] = [
  { id: 'hot-coffee', name: 'Hot Coffee', description: 'Brewed hot coffee drinks.' },
  { id: 'iced-coffee', name: 'Iced Coffee', description: 'Coffee served over ice.' },
  { id: 'espresso', name: 'Espresso', description: 'Espresso-based drinks.' },
  { id: 'cold-brew', name: 'Cold Brew', description: 'Slow-steeped cold brew coffee.' },
  { id: 'latte', name: 'Latte', description: 'Espresso with steamed milk.' },
  { id: 'cappuccino', name: 'Cappuccino', description: 'Espresso with steamed milk and foam.' },
  { id: 'macchiato', name: 'Macchiato', description: 'Espresso "marked" with milk or foam.' },
  { id: 'mocha', name: 'Mocha', description: 'Espresso with mocha sauce and milk.' },
  { id: 'americano', name: 'Americano', description: 'Espresso with hot water.' },
  { id: 'shaken-espresso', name: 'Shaken Espresso', description: 'Espresso shaken with ice.' },
  { id: 'frappuccino', name: 'Frappuccino', description: 'Blended iced beverages.' },
  { id: 'refreshers', name: 'Refreshers', description: 'Fruit-flavored refreshers.' },
  { id: 'matcha', name: 'Matcha', description: 'Matcha green tea drinks.' },
  { id: 'chai', name: 'Chai', description: 'Chai tea drinks.' },
  { id: 'tea', name: 'Tea', description: 'Brewed and iced teas.' },
  { id: 'other', name: 'Other', description: 'Other beverages.' },
  { id: 'food', name: 'Food', description: 'Bakery and food items.' },
];
