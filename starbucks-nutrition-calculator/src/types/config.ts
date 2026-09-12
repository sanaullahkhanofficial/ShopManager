import type { SizeId } from './drink';

export type WhipLevel = 'none' | 'light' | 'standard' | 'extra';

/** The full, serializable state of one calculator configuration. Same shape in memory, in the URL, and in localStorage. */
export interface DrinkConfiguration {
  drinkId: string;
  sizeId: SizeId;
  milkId: string | null;
  espressoShots: number | null;
  syrupPumps: number;
  saucePumps: number;
  sweetener: boolean;
  coldFoam: boolean;
  whip: WhipLevel;
  toppings: string[];
}

export function defaultConfiguration(drinkId: string, sizeId: SizeId, milkId: string | null, shots: number | null): DrinkConfiguration {
  return {
    drinkId,
    sizeId,
    milkId,
    espressoShots: shots,
    syrupPumps: 0,
    saucePumps: 0,
    sweetener: false,
    coldFoam: false,
    whip: 'none',
    toppings: [],
  };
}
