import type { MilkOption } from '@/types/customization';
import { DATA_VERSION, LAST_REVIEWED } from './meta';

const src = (note: string, sourceUrl: string | null = null) => ({
  status: 'needs-review' as const,
  note,
  sourceUrl,
  dataVersion: DATA_VERSION,
  lastReviewed: LAST_REVIEWED,
});

/**
 * Reference-only 8 fl oz milk nutrition, for the Milk Options content section.
 * These are NOT applied automatically as per-drink swap deltas (see
 * MilkOption.referenceNutritionPer8Oz jsdoc) because a verified, per-drink,
 * per-size milk-substitution delta is not available for this dataset yet.
 * Some third-party sources disagree on exact figures (most visibly for
 * almond milk, reported anywhere from ~60-80 kcal per 8 fl oz); where sources
 * conflicted we kept the field but flagged it in the note rather than average
 * or guess a "safe middle" number.
 */
export const MILK_OPTIONS: MilkOption[] = [
  {
    id: 'whole',
    name: 'Whole Milk',
    kind: 'dairy',
    allergens: ['milk'],
    referenceNutritionPer8Oz: {
      calories: 150,
      totalFatG: 8,
      saturatedFatG: 5,
      transFatG: null,
      cholesterolMg: null,
      sodiumMg: null,
      carbohydratesG: 12,
      fiberG: 0,
      sugarG: 12,
      proteinG: 8,
      caffeineMg: 0,
    },
    source: src('Third-party aggregate figures for an 8 fl oz serving of whole milk.'),
  },
  {
    id: '2percent',
    name: '2% Milk',
    kind: 'dairy',
    allergens: ['milk'],
    referenceNutritionPer8Oz: {
      calories: 120,
      totalFatG: 5,
      saturatedFatG: 3,
      transFatG: null,
      cholesterolMg: null,
      sodiumMg: null,
      carbohydratesG: 12,
      fiberG: 0,
      sugarG: 12,
      proteinG: 8,
      caffeineMg: 0,
    },
    source: src('Default milk in most Starbucks hot espresso drinks unless another milk is requested.'),
  },
  {
    id: 'nonfat',
    name: 'Nonfat Milk',
    kind: 'dairy',
    allergens: ['milk'],
    referenceNutritionPer8Oz: {
      calories: 80,
      totalFatG: 0,
      saturatedFatG: 0,
      transFatG: null,
      cholesterolMg: null,
      sodiumMg: null,
      carbohydratesG: 12,
      fiberG: 0,
      sugarG: 12,
      proteinG: 8,
      caffeineMg: 0,
    },
    source: src('Third-party aggregate figures for an 8 fl oz serving of nonfat (skim) milk.'),
  },
  {
    id: 'oat',
    name: 'Oatmilk',
    kind: 'plant-based',
    allergens: [],
    referenceNutritionPer8Oz: {
      calories: 120,
      totalFatG: 5,
      saturatedFatG: 0.5,
      transFatG: null,
      cholesterolMg: null,
      sodiumMg: null,
      carbohydratesG: 16,
      fiberG: 2,
      sugarG: 7,
      proteinG: 3,
      caffeineMg: 0,
    },
    source: src('Starbucks uses Oatly Barista Edition oatmilk. Figures approximate for an 8 fl oz serving.'),
  },
  {
    id: 'almond',
    name: 'Almondmilk',
    kind: 'plant-based',
    allergens: ['tree nuts'],
    referenceNutritionPer8Oz: {
      calories: 60,
      totalFatG: 2.5,
      saturatedFatG: 0,
      transFatG: null,
      cholesterolMg: null,
      sodiumMg: null,
      carbohydratesG: 7,
      fiberG: 1,
      sugarG: 4,
      proteinG: 1,
      caffeineMg: 0,
    },
    source: src(
      'Third-party sources disagree on exact figures (roughly 60-80 kcal per 8 fl oz depending on source); shown as reported by the lower-end sources pending direct verification.'
    ),
  },
  {
    id: 'soy',
    name: 'Soymilk',
    kind: 'plant-based',
    allergens: ['soy'],
    referenceNutritionPer8Oz: {
      calories: 100,
      totalFatG: 4,
      saturatedFatG: 0.5,
      transFatG: null,
      cholesterolMg: null,
      sodiumMg: null,
      carbohydratesG: 8,
      fiberG: 1,
      sugarG: 6,
      proteinG: 7,
      caffeineMg: 0,
    },
    source: src('Third-party aggregate figures for an 8 fl oz serving of soymilk.'),
  },
  {
    id: 'coconut',
    name: 'Coconutmilk',
    kind: 'plant-based',
    allergens: [],
    referenceNutritionPer8Oz: {
      calories: 70,
      totalFatG: 5,
      saturatedFatG: 5,
      transFatG: null,
      cholesterolMg: null,
      sodiumMg: null,
      carbohydratesG: 7,
      fiberG: 0,
      sugarG: 6,
      proteinG: 0,
      caffeineMg: 0,
    },
    source: src('Third-party aggregate figures for an 8 fl oz serving of coconutmilk.'),
  },
];

export const MILK_BY_ID: Record<string, MilkOption> = Object.fromEntries(MILK_OPTIONS.map((m) => [m.id, m]));
