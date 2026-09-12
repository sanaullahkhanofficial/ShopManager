import type { Drink } from './drink';
import type { CustomizationOptions, MilkOption } from './customization';
import type { CategoryMeta } from '@/data/us/categories';

export interface NutritionDatabase {
  drinks: Drink[];
  milks: MilkOption[];
  modifiers: CustomizationOptions;
  categories: CategoryMeta[];
  dataVersion: string;
}
