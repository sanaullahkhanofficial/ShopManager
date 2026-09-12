import type { NutritionDelta, SourceInfo } from './nutrition';

export type MilkKind = 'dairy' | 'plant-based';

export interface MilkOption {
  id: string;
  name: string;
  kind: MilkKind;
  allergens: string[];
  /**
   * Reference-only nutrition for an 8 fl oz serving of this milk on its own.
   * This is informational (shown in the Milk Options content section) and is
   * NOT applied as an automatic per-drink swap delta, because verified,
   * drink-specific milk-swap figures are not available for every drink/size
   * combination in this dataset. See CustomizationRule.milkSwapSupported.
   */
  referenceNutritionPer8Oz: NutritionDelta | null;
  source: SourceInfo;
}

export type ToppingLevel = 'none' | 'light' | 'standard' | 'extra';

/**
 * A per-unit nutrition effect for a modifier (an espresso shot, a pump of syrup,
 * a serving of whipped cream, etc). When `perUnit` is null, the effect on
 * nutrition is not in the verified dataset and must never be estimated -
 * the UI must show "Ingredient-level calculation unavailable for this
 * customization" instead of a number.
 */
export interface ModifierEffect {
  id: string;
  name: string;
  unit: 'shot' | 'pump' | 'serving';
  min: number;
  max: number;
  default: number;
  perUnit: NutritionDelta | null;
  source: SourceInfo;
}

export interface CustomizationOptions {
  espressoShot: ModifierEffect;
  whippedCream: ModifierEffect;
  syrupPump: ModifierEffect; // perUnit intentionally null - unavailable
  saucePump: ModifierEffect; // perUnit intentionally null - unavailable
}
