import type { NutritionDatabase } from '@/types/database';
import { DRINKS } from './drinks';
import { FOOD_ITEMS } from './food';
import { MILK_OPTIONS } from './milk';
import { MODIFIERS } from './modifiers';
import { ALL_CATEGORIES } from './categories';
import { DATA_VERSION } from './meta';

export const DATABASE: NutritionDatabase = {
  drinks: DRINKS,
  foods: FOOD_ITEMS,
  milks: MILK_OPTIONS,
  modifiers: MODIFIERS,
  categories: ALL_CATEGORIES,
  dataVersion: DATA_VERSION,
};

export * from './drinks';
export * from './food';
export * from './milk';
export * from './modifiers';
export * from './categories';
export * from './meta';
