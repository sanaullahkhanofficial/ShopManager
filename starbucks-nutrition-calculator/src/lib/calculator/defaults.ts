import type { Drink } from '@/types/drink';
import type { DrinkConfiguration } from '@/types/config';
import { defaultConfiguration } from '@/types/config';

export function buildDefaultConfiguration(drink: Drink): DrinkConfiguration {
  return defaultConfiguration(
    drink.id,
    drink.defaultSizeId,
    drink.eligibility.milk ? drink.defaultMilkId : null,
    drink.eligibility.shots ? drink.defaultEspressoShots : null
  );
}
