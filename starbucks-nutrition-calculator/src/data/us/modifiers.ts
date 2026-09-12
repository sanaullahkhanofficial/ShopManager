import type { CustomizationOptions } from '@/types/customization';
import { DATA_VERSION, LAST_REVIEWED } from './meta';

const src = (note: string, status: 'needs-review' | 'unavailable' = 'needs-review') => ({
  status,
  note,
  sourceUrl: null,
  dataVersion: DATA_VERSION,
  lastReviewed: LAST_REVIEWED,
});

export const MODIFIERS: CustomizationOptions = {
  espressoShot: {
    id: 'espresso-shot',
    name: 'Espresso Shot',
    unit: 'shot',
    min: 0,
    max: 6,
    default: 2,
    perUnit: {
      calories: 5,
      totalFatG: 0,
      saturatedFatG: 0,
      transFatG: 0,
      cholesterolMg: 0,
      sodiumMg: 0,
      carbohydratesG: 0,
      fiberG: 0,
      sugarG: 0,
      proteinG: 1,
      caffeineMg: 75,
    },
    source: src('A single Starbucks espresso shot is consistently reported across sources as ~5 kcal and ~75 mg caffeine.'),
  },
  whippedCream: {
    id: 'whipped-cream',
    name: 'Whipped Cream',
    unit: 'serving',
    min: 0,
    max: 1,
    default: 0,
    perUnit: {
      calories: 70,
      totalFatG: null,
      saturatedFatG: null,
      transFatG: null,
      cholesterolMg: null,
      sodiumMg: null,
      carbohydratesG: null,
      fiberG: null,
      sugarG: 1,
      proteinG: 0,
      caffeineMg: 0,
    },
    source: src(
      'Derived by comparing a Grande Caffè Mocha with whipped cream (370 kcal / 35 g sugar) to the same drink without whipped cream (300 kcal / 34 g sugar). Fat/carb/sodium deltas were not available from the same comparison and are left null rather than estimated.'
    ),
  },
  syrupPump: {
    id: 'syrup-pump',
    name: 'Flavored Syrup',
    unit: 'pump',
    min: 0,
    max: 8,
    default: 0,
    perUnit: null,
    source: src(
      'Ingredient-level calculation unavailable for this customization: verified per-pump syrup nutrition was not available for this dataset.',
      'unavailable'
    ),
  },
  saucePump: {
    id: 'sauce-pump',
    name: 'Flavored Sauce',
    unit: 'pump',
    min: 0,
    max: 8,
    default: 0,
    perUnit: null,
    source: src(
      'Ingredient-level calculation unavailable for this customization: verified per-pump sauce nutrition was not available for this dataset.',
      'unavailable'
    ),
  },
};
