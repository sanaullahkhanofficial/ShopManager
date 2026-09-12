import type { Drink } from '@/types/drink';
import type { CategoryMeta } from '@/data/us/categories';

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Instant, case-insensitive, whitespace-tolerant, partial-match search over
 * drink names, aliases, and category names. "caramel mach" matches
 * "Caramel Macchiato" because every whitespace-separated token in the query
 * must appear as a substring somewhere in the drink's searchable text.
 */
export function searchDrinks(query: string, drinks: Drink[], categories: CategoryMeta[]): Drink[] {
  const q = normalize(query);
  if (!q) return drinks;
  const tokens = q.split(' ').filter(Boolean);
  const categoryNameById = new Map(categories.map((c) => [c.id, normalize(c.name)]));

  return drinks.filter((drink) => {
    const haystack = [drink.name, ...drink.aliases, categoryNameById.get(drink.category) ?? drink.category, drink.subcategory ?? ''].map(normalize).join(' | ');
    return tokens.every((token) => haystack.includes(token));
  });
}
