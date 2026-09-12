import type { NutritionDatabase } from '@/types/database';
import type { CategoryMeta } from '@/data/us/categories';

/** Only exposes categories that actually have at least one drink in the current database. */
export function getActiveCategories(database: NutritionDatabase): CategoryMeta[] {
  const present = new Set(database.drinks.map((d) => d.category));
  return database.categories.filter((c) => present.has(c.id));
}
