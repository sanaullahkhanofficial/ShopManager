import type { NutritionFacts, SourceInfo } from './nutrition';

export type FoodCategory = 'bakery' | 'sandwiches' | 'snacks' | 'other';

export interface FoodItem {
  id: string;
  slug: string;
  name: string;
  category: FoodCategory;
  /** Human-readable serving description, e.g. "1 croissant (62 g)". Food items don't have a "size" the way drinks do. */
  servingSize: string;
  description: string;
  nutrition: NutritionFacts;
  ingredients: string[];
  allergens: string[];
  source: SourceInfo;
  region: 'US';
}
