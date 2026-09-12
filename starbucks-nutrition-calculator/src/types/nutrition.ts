/**
 * Nutrition fields follow U.S. Nutrition Facts conventions.
 * Any field whose verified value is unknown MUST be `null` — never a guessed number.
 * Consumers must render `null` as "—" (data not available), not as 0.
 */
export interface NutritionFacts {
  calories: number | null;
  totalFatG: number | null;
  saturatedFatG: number | null;
  transFatG: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  carbohydratesG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  proteinG: number | null;
  caffeineMg: number | null;
}

export const EMPTY_NUTRITION: NutritionFacts = {
  calories: null,
  totalFatG: null,
  saturatedFatG: null,
  transFatG: null,
  cholesterolMg: null,
  sodiumMg: null,
  carbohydratesG: null,
  fiberG: null,
  sugarG: null,
  proteinG: null,
  caffeineMg: null,
};

/** A field-by-field nutrition change, used for "what changed" and "smart swap" comparisons. */
export type NutritionDelta = {
  [K in keyof NutritionFacts]: number | null;
};

/** Review/trust status for any data record. Production UI must never present anything but "verified" as fact. */
export type DataStatus = 'verified' | 'needs-review' | 'placeholder' | 'unavailable';

export interface SourceInfo {
  status: DataStatus;
  /** Human-readable description of where the figures came from. */
  note: string;
  /** Canonical source URL (e.g. the Starbucks nutrition page for this product), when known. */
  sourceUrl: string | null;
  dataVersion: string;
  lastReviewed: string; // ISO date
}
