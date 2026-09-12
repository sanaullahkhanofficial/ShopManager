import type { Drink } from '@/types/drink';
import type { NutritionDatabase } from '@/types/database';
import type { DrinkConfiguration } from '@/types/config';

interface Props {
  drink: Drink;
  database: NutritionDatabase;
  configuration: DrinkConfiguration;
}

export function CustomizationSummary({ drink, database, configuration }: Props) {
  const size = drink.sizes.find((s) => s.id === configuration.sizeId);
  const milk = configuration.milkId ? database.milks.find((m) => m.id === configuration.milkId) : null;

  const items: string[] = [];
  if (size) items.push(size.name);
  if (milk) items.push(milk.name);
  if (configuration.espressoShots !== null) items.push(`${configuration.espressoShots} Espresso Shot${configuration.espressoShots === 1 ? '' : 's'}`);
  if (configuration.syrupPumps > 0) items.push(`${configuration.syrupPumps} Syrup Pump${configuration.syrupPumps === 1 ? '' : 's'}`);
  if (configuration.saucePumps > 0) items.push(`${configuration.saucePumps} Sauce Pump${configuration.saucePumps === 1 ? '' : 's'}`);
  if (configuration.sweetener) items.push('Sweetener');
  if (configuration.coldFoam) items.push('Cold Foam');
  items.push(configuration.whip === 'none' ? 'No Whipped Cream' : `${configuration.whip.charAt(0).toUpperCase()}${configuration.whip.slice(1)} Whipped Cream`);
  if (configuration.toppings.length > 0) items.push(...configuration.toppings);

  return (
    <div className="customization-summary">
      <p className="customization-summary__title">Your customizations</p>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
