import type { FoodItem } from '@/types/food';
import type { NutritionFacts, SourceInfo } from '@/types/nutrition';
import { EMPTY_NUTRITION } from '@/types/nutrition';
import { DATA_VERSION, LAST_REVIEWED } from './meta';

function n(f: Partial<NutritionFacts>): NutritionFacts {
  return { ...EMPTY_NUTRITION, ...f };
}

function source(sourceUrl: string | null, note?: string): SourceInfo {
  return {
    status: 'needs-review',
    note:
      note ??
      (sourceUrl
        ? 'Compiled from publicly available Starbucks nutrition data via third-party nutrition trackers; pending direct verification against the linked Starbucks nutrition page.'
        : 'Search did not surface a specific starbucks.com product page for this item; figures are from third-party trackers only. Verify against starbucks.com/menu before treating as final.'),
    sourceUrl,
    dataVersion: DATA_VERSION,
    lastReviewed: LAST_REVIEWED,
  };
}

export const FOOD_ITEMS: FoodItem[] = [
  {
    id: 'butter-croissant',
    slug: 'butter-croissant',
    name: 'Butter Croissant',
    category: 'bakery',
    servingSize: '1 croissant (about 62 g)',
    description: 'A flaky, buttery classic croissant, baked fresh.',
    nutrition: n({ calories: 250, totalFatG: 14, saturatedFatG: 8, cholesterolMg: 45, sodiumMg: 300, carbohydratesG: 26, fiberG: 1, sugarG: 4, proteinG: 5 }),
    ingredients: ['enriched wheat flour', 'butter', 'sugar', 'eggs'],
    allergens: ['milk', 'wheat', 'egg'],
    source: source(null),
    region: 'US',
  },
  {
    id: 'chocolate-croissant',
    slug: 'chocolate-croissant',
    name: 'Chocolate Croissant',
    category: 'bakery',
    servingSize: '1 croissant (about 80 g)',
    description: 'A butter croissant filled with rich chocolate.',
    nutrition: n({ calories: 340, totalFatG: 20, saturatedFatG: 12, sodiumMg: 280, carbohydratesG: 38, fiberG: 2, sugarG: 13, proteinG: 5 }),
    ingredients: ['enriched wheat flour', 'butter', 'chocolate', 'sugar', 'eggs'],
    allergens: ['milk', 'wheat', 'egg'],
    source: source('https://www.starbucks.com/menu/product/1028/single/nutrition'),
    region: 'US',
  },
  {
    id: 'blueberry-streusel-muffin',
    slug: 'blueberry-streusel-muffin',
    name: 'Blueberry Streusel Muffin',
    category: 'bakery',
    servingSize: '1 muffin',
    description: 'A classic blueberry muffin topped with a sweet streusel crumb.',
    nutrition: n({ calories: 370, totalFatG: 18, saturatedFatG: 4, carbohydratesG: 47, sugarG: 27, proteinG: 5 }),
    ingredients: ['enriched wheat flour', 'blueberries', 'sugar', 'eggs', 'soybean oil'],
    allergens: ['milk', 'wheat', 'egg', 'soy'],
    source: source(
      'https://www.starbucks.com/menu/product/2123882/single/nutrition',
      'Sources vary somewhat (roughly 330-370 kcal reported); the figure most consistently cited was used, pending direct verification.'
    ),
    region: 'US',
  },
  {
    id: 'bacon-gouda-egg-sandwich',
    slug: 'bacon-gouda-egg-sandwich',
    name: 'Bacon, Gouda & Egg Sandwich',
    category: 'sandwiches',
    servingSize: '1 sandwich',
    description: 'Applewood-smoked bacon, a fried egg and smoked Gouda cheese on an artisan roll.',
    nutrition: n({ calories: 360, totalFatG: 18, saturatedFatG: 6, sodiumMg: 710, carbohydratesG: 35, fiberG: 1, sugarG: 2, proteinG: 18 }),
    ingredients: ['artisan roll', 'egg', 'bacon', 'gouda cheese'],
    allergens: ['milk', 'wheat', 'egg'],
    source: source('https://www.starbucks.com/menu/product/369/single/nutrition'),
    region: 'US',
  },
];

export const FOOD_BY_ID: Record<string, FoodItem> = Object.fromEntries(FOOD_ITEMS.map((f) => [f.id, f]));
export const FOOD_BY_SLUG: Record<string, FoodItem> = Object.fromEntries(FOOD_ITEMS.map((f) => [f.slug, f]));
