import type { Drink } from './drink';
import type { CustomizationOptions, MilkOption } from './customization';
import type { CategoryMeta } from '@/data/us/categories';
import type { FoodItem } from './food';

export interface NutritionDatabase {
  drinks: Drink[];
  foods: FoodItem[];
  milks: MilkOption[];
  modifiers: CustomizationOptions;
  categories: CategoryMeta[];
  dataVersion: string;
}
