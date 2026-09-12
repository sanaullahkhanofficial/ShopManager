import type { NutritionFacts, SourceInfo } from './nutrition';

export type DrinkCategory =
  | 'hot-coffee'
  | 'iced-coffee'
  | 'espresso'
  | 'cold-brew'
  | 'latte'
  | 'cappuccino'
  | 'macchiato'
  | 'mocha'
  | 'americano'
  | 'shaken-espresso'
  | 'frappuccino'
  | 'refreshers'
  | 'matcha'
  | 'chai'
  | 'tea'
  | 'other'
  | 'food';

export type SizeId = 'short' | 'tall' | 'grande' | 'venti' | 'trenta';

export interface DrinkSize {
  id: SizeId;
  name: string;
  fluidOz: number;
  /** Nutrition for this drink at this size, using the drink's default recipe. */
  nutrition: NutritionFacts;
  available: boolean;
  source: SourceInfo;
}

export type ModifierKind = 'milk' | 'shots' | 'syrup' | 'sauce' | 'sweetener' | 'coldFoam' | 'whip' | 'topping';

export interface CustomizationEligibility {
  milk: boolean;
  shots: boolean;
  syrup: boolean;
  sauce: boolean;
  sweetener: boolean;
  coldFoam: boolean;
  whip: boolean;
  topping: boolean;
}

export interface Drink {
  id: string;
  slug: string;
  name: string;
  category: DrinkCategory;
  subcategory: string | null;
  description: string;
  aliases: string[];
  sizes: DrinkSize[];
  defaultSizeId: SizeId;
  /** Milk option ids this drink supports, in display order. Empty when the drink has no milk (e.g. black coffee). */
  eligibleMilkIds: string[];
  defaultMilkId: string | null;
  defaultEspressoShots: number | null;
  minEspressoShots: number | null;
  maxEspressoShots: number | null;
  eligibility: CustomizationEligibility;
  allergens: string[];
  source: SourceInfo;
  region: 'US';
}
