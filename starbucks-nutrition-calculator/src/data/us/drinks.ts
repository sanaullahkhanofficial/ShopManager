import type { Drink, DrinkSize, SizeId } from '@/types/drink';
import type { NutritionFacts, SourceInfo } from '@/types/nutrition';
import { EMPTY_NUTRITION } from '@/types/nutrition';
import { DATA_VERSION, LAST_REVIEWED } from './meta';

function source(
  sourceUrl: string,
  note = 'Compiled from publicly available Starbucks nutrition data via third-party nutrition trackers; pending direct verification against the linked Starbucks nutrition page.'
): SourceInfo {
  return { status: 'needs-review', note, sourceUrl, dataVersion: DATA_VERSION, lastReviewed: LAST_REVIEWED };
}

function unavailableSize(id: SizeId, name: string, fluidOz: number): DrinkSize {
  return {
    id,
    name,
    fluidOz,
    nutrition: EMPTY_NUTRITION,
    available: false,
    source: {
      status: 'unavailable',
      note: 'Not yet in the verified dataset for this drink.',
      sourceUrl: null,
      dataVersion: DATA_VERSION,
      lastReviewed: LAST_REVIEWED,
    },
  };
}

function n(f: Partial<NutritionFacts>): NutritionFacts {
  return { ...EMPTY_NUTRITION, ...f };
}

const SIZE_NAMES: Record<SizeId, [string, number]> = {
  short: ['Short', 8],
  tall: ['Tall', 12],
  grande: ['Grande', 16],
  venti: ['Venti', 20],
  trenta: ['Trenta', 30],
};

/** Builds a full size list for the given hidden sizes plus one verified/needs-review size with real data. */
function sizesWith(knownId: SizeId, nutrition: NutritionFacts, src: SourceInfo, otherSizeIds: SizeId[]): DrinkSize[] {
  const [name, oz] = SIZE_NAMES[knownId];
  const known: DrinkSize = { id: knownId, name, fluidOz: oz, nutrition, available: true, source: src };
  const others = otherSizeIds.filter((s) => s !== knownId).map((s) => unavailableSize(s, SIZE_NAMES[s][0], SIZE_NAMES[s][1]));
  return [known, ...others].sort((a, b) => a.fluidOz - b.fluidOz);
}

const HOT_ESPRESSO_SIZE_SET: SizeId[] = ['short', 'tall', 'grande', 'venti'];
const ICED_ESPRESSO_SIZE_SET: SizeId[] = ['tall', 'grande', 'venti'];
const COLD_BREW_SIZE_SET: SizeId[] = ['tall', 'grande', 'venti', 'trenta'];

const fullEligibility = {
  milk: true,
  shots: true,
  syrup: true,
  sauce: false,
  sweetener: true,
  coldFoam: false,
  whip: false,
  topping: false,
};

export const DRINKS: Drink[] = [
  {
    id: 'caffe-latte',
    slug: 'caffe-latte',
    name: 'Caffè Latte',
    category: 'latte',
    subcategory: 'Hot Coffee',
    description: 'Rich, full-bodied espresso balanced with steamed milk and a light layer of foam.',
    aliases: ['latte', 'coffee latte'],
    sizes: sizesWith(
      'grande',
      n({ calories: 190, totalFatG: 7, saturatedFatG: 4.5, carbohydratesG: 19, sugarG: 18, proteinG: 13, caffeineMg: 150 }),
      source('https://www.starbucks.com/menu/product/407/hot/nutrition'),
      HOT_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: '2percent',
    defaultEspressoShots: 2,
    minEspressoShots: 1,
    maxEspressoShots: 6,
    eligibility: { ...fullEligibility, whip: false },
    allergens: ['milk'],
    source: source('https://www.starbucks.com/menu/product/407/hot/nutrition'),
    region: 'US',
  },
  {
    id: 'cappuccino',
    slug: 'cappuccino',
    name: 'Cappuccino',
    category: 'cappuccino',
    subcategory: 'Hot Coffee',
    description: 'Dark, rich espresso topped with a deep layer of steamed milk foam.',
    aliases: ['capp'],
    sizes: sizesWith(
      'grande',
      n({ calories: 140, totalFatG: 5, sodiumMg: 120, carbohydratesG: 14, sugarG: 12, proteinG: 9, caffeineMg: 150 }),
      source('https://www.starbucks.com/menu/product/409/hot/nutrition'),
      HOT_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: '2percent',
    defaultEspressoShots: 2,
    minEspressoShots: 1,
    maxEspressoShots: 6,
    eligibility: fullEligibility,
    allergens: ['milk'],
    source: source('https://www.starbucks.com/menu/product/409/hot/nutrition'),
    region: 'US',
  },
  {
    id: 'caramel-macchiato',
    slug: 'caramel-macchiato',
    name: 'Caramel Macchiato',
    category: 'macchiato',
    subcategory: 'Hot Coffee',
    description: 'Freshly steamed milk with vanilla-flavored syrup marked with espresso and topped with caramel drizzle.',
    aliases: ['caramel mach', 'macchiato'],
    sizes: sizesWith(
      'grande',
      n({ calories: 250, totalFatG: 7, saturatedFatG: 4.5, carbohydratesG: 35, sugarG: 33, proteinG: 10, caffeineMg: 150 }),
      source('https://www.starbucks.com/menu/product/413/hot/nutrition'),
      HOT_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: '2percent',
    defaultEspressoShots: 2,
    minEspressoShots: 1,
    maxEspressoShots: 6,
    eligibility: fullEligibility,
    allergens: ['milk'],
    source: source('https://www.starbucks.com/menu/product/413/hot/nutrition'),
    region: 'US',
  },
  {
    id: 'iced-caramel-macchiato',
    slug: 'iced-caramel-macchiato',
    name: 'Iced Caramel Macchiato',
    category: 'macchiato',
    subcategory: 'Iced Coffee',
    description: 'Iced version of the Caramel Macchiato: milk, vanilla syrup, ice, espresso and caramel drizzle.',
    aliases: ['iced caramel mach'],
    sizes: sizesWith(
      'grande',
      n({ calories: 250, totalFatG: 7, saturatedFatG: 4.5, sodiumMg: 150, carbohydratesG: 37, sugarG: 34, proteinG: 10, caffeineMg: 150 }),
      source('https://www.starbucks.com/menu/product/413/iced/nutrition'),
      ICED_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: '2percent',
    defaultEspressoShots: 2,
    minEspressoShots: 1,
    maxEspressoShots: 6,
    eligibility: fullEligibility,
    allergens: ['milk'],
    source: source('https://www.starbucks.com/menu/product/413/iced/nutrition'),
    region: 'US',
  },
  {
    id: 'caffe-americano',
    slug: 'caffe-americano',
    name: 'Caffè Americano',
    category: 'americano',
    subcategory: 'Espresso',
    description: 'Espresso shots topped with hot water for a light layer of crema.',
    aliases: ['americano'],
    sizes: sizesWith(
      'grande',
      n({
        calories: 15,
        totalFatG: 0,
        saturatedFatG: 0,
        transFatG: 0,
        cholesterolMg: 0,
        sodiumMg: 10,
        carbohydratesG: 2,
        fiberG: 0,
        sugarG: 0,
        proteinG: 1,
        caffeineMg: 225,
      }),
      source('https://www.starbucks.com/menu/product/406/hot/nutrition'),
      HOT_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: null,
    defaultEspressoShots: 3,
    minEspressoShots: 1,
    maxEspressoShots: 6,
    eligibility: { ...fullEligibility, milk: true },
    allergens: [],
    source: source('https://www.starbucks.com/menu/product/406/hot/nutrition'),
    region: 'US',
  },
  {
    id: 'cold-brew',
    slug: 'cold-brew',
    name: 'Cold Brew',
    category: 'cold-brew',
    subcategory: 'Cold Brew',
    description: 'Slow-steeped, super-smooth cold brew served over ice, unsweetened.',
    aliases: ['coldbrew'],
    sizes: sizesWith(
      'grande',
      n({ calories: 5, totalFatG: 0, sodiumMg: 15, carbohydratesG: 0, sugarG: 0, proteinG: 0, caffeineMg: 205 }),
      source('https://www.starbucks.com/menu/product/2121255/iced/nutrition'),
      COLD_BREW_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: null,
    defaultEspressoShots: null,
    minEspressoShots: null,
    maxEspressoShots: null,
    eligibility: { ...fullEligibility, shots: false, coldFoam: true },
    allergens: [],
    source: source('https://www.starbucks.com/menu/product/2121255/iced/nutrition'),
    region: 'US',
  },
  {
    id: 'pike-place-roast',
    slug: 'pike-place-roast',
    name: 'Pike Place Roast',
    category: 'hot-coffee',
    subcategory: 'Brewed Coffee',
    description: 'A smooth, medium-roast brewed coffee with subtly rich flavor, served hot, black by default.',
    aliases: ['pike place', 'brewed coffee'],
    sizes: sizesWith(
      'grande',
      n({ calories: 5, totalFatG: 0, carbohydratesG: 0 }),
      source('https://www.starbucks.com/menu/product/480/hot/nutrition'),
      HOT_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: null,
    defaultEspressoShots: null,
    minEspressoShots: null,
    maxEspressoShots: null,
    eligibility: { ...fullEligibility, shots: false },
    allergens: [],
    source: source(
      'https://www.starbucks.com/menu/product/480/hot/nutrition',
      'Calorie/fat/carb figures cross-referenced across sources; caffeine was not consistently reported and is left unavailable rather than estimated.'
    ),
    region: 'US',
  },
  {
    id: 'caffe-mocha',
    slug: 'caffe-mocha',
    name: 'Caffè Mocha',
    category: 'mocha',
    subcategory: 'Hot Coffee',
    description: 'Rich mocha sauce, espresso and steamed milk, topped with whipped cream.',
    aliases: ['mocha'],
    sizes: sizesWith(
      'grande',
      n({ calories: 370, totalFatG: 15, saturatedFatG: 10, carbohydratesG: 43, sugarG: 35, proteinG: 14, caffeineMg: 175 }),
      source('https://www.starbucks.com/menu/product/408/hot/nutrition'),
      HOT_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: '2percent',
    defaultEspressoShots: 2,
    minEspressoShots: 1,
    maxEspressoShots: 6,
    eligibility: { ...fullEligibility, whip: true },
    allergens: ['milk'],
    source: source('https://www.starbucks.com/menu/product/408/hot/nutrition'),
    region: 'US',
  },
  {
    id: 'chai-tea-latte',
    slug: 'chai-tea-latte',
    name: 'Chai Tea Latte',
    category: 'chai',
    subcategory: 'Tea',
    description: 'Black tea infused with cinnamon, clove and other warming spices, combined with steamed milk.',
    aliases: ['chai latte', 'chai'],
    sizes: sizesWith(
      'grande',
      n({ calories: 200, sugarG: 31, proteinG: 6, caffeineMg: 60 }),
      source('https://www.starbucks.com/menu/product/466/hot/nutrition'),
      HOT_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: '2percent',
    defaultEspressoShots: null,
    minEspressoShots: null,
    maxEspressoShots: null,
    eligibility: { ...fullEligibility, shots: false },
    allergens: ['milk'],
    source: source(
      'https://www.starbucks.com/menu/product/466/hot/nutrition',
      'Sources show some variation (200-240 kcal reported); the figure most recently cited as current Starbucks data was used.'
    ),
    region: 'US',
  },
  {
    id: 'matcha-latte',
    slug: 'matcha-latte',
    name: 'Matcha Latte',
    category: 'matcha',
    subcategory: 'Tea',
    description: 'Smooth and creamy matcha green tea sweetened and combined with milk.',
    aliases: ['matcha'],
    sizes: sizesWith(
      'grande',
      n({ calories: 220, totalFatG: 6, saturatedFatG: 4, carbohydratesG: 31, fiberG: 1, sugarG: 29, proteinG: 11, caffeineMg: 65 }),
      source('https://www.starbucks.com/menu/product/468/hot/nutrition'),
      HOT_ESPRESSO_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['whole', '2percent', 'nonfat', 'oat', 'almond', 'soy', 'coconut'],
    defaultMilkId: '2percent',
    defaultEspressoShots: null,
    minEspressoShots: null,
    maxEspressoShots: null,
    eligibility: { ...fullEligibility, shots: false },
    allergens: ['milk'],
    source: source('https://www.starbucks.com/menu/product/468/hot/nutrition'),
    region: 'US',
  },
  {
    id: 'strawberry-acai-refresher',
    slug: 'strawberry-acai-refresher',
    name: 'Strawberry Açaí Refresher',
    category: 'refreshers',
    subcategory: 'Refreshers',
    description: 'Sweet strawberry flavors accented by passion fruit and açaí notes, made with real fruit pieces, served with water and ice.',
    aliases: ['pink drink base', 'strawberry refresher'],
    sizes: sizesWith(
      'grande',
      n({ calories: 90, sodiumMg: 15, carbohydratesG: 23, fiberG: 1, sugarG: 21, proteinG: 0, totalFatG: 0, caffeineMg: 50 }),
      source('https://www.starbucks.com/menu/product/2121342/iced/nutrition'),
      COLD_BREW_SIZE_SET
    ),
    defaultSizeId: 'grande',
    eligibleMilkIds: ['coconut'],
    defaultMilkId: null,
    defaultEspressoShots: null,
    minEspressoShots: null,
    maxEspressoShots: null,
    eligibility: { milk: true, shots: false, syrup: false, sauce: false, sweetener: false, coldFoam: false, whip: false, topping: false },
    allergens: [],
    source: source('https://www.starbucks.com/menu/product/2121342/iced/nutrition'),
    region: 'US',
  },
];

export const DRINK_BY_ID: Record<string, Drink> = Object.fromEntries(DRINKS.map((d) => [d.id, d]));
export const DRINK_BY_SLUG: Record<string, Drink> = Object.fromEntries(DRINKS.map((d) => [d.slug, d]));
