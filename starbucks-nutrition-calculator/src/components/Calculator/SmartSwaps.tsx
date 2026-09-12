import { useMemo } from 'react';
import type { NutritionDatabase } from '@/types/database';
import type { NutritionFacts } from '@/types/nutrition';
import { getSmartSwaps } from '@/lib/smartSwaps';
import { formatValue } from '@/lib/format';

interface Props {
  drinkId: string;
  nutrition: NutritionFacts;
  database: NutritionDatabase;
  onSelectDrink: (drinkId: string) => void;
}

export function SmartSwaps({ drinkId, nutrition, database, onSelectDrink }: Props) {
  const suggestions = useMemo(() => getSmartSwaps(drinkId, nutrition, database).slice(0, 3), [drinkId, nutrition, database]);
  if (suggestions.length === 0) return null;

  return (
    <section className="smart-swaps" aria-label="Smart swaps">
      <p className="smart-swaps__title">You might also consider</p>
      <ul>
        {suggestions.map((s) => (
          <li key={`${s.label}-${s.drink.id}`}>
            <button type="button" className="smart-swaps__item" onClick={() => onSelectDrink(s.drink.id)}>
              <span className="smart-swaps__badge">{s.label}</span>
              <span className="smart-swaps__name">{s.drink.name}</span>
              <span className="smart-swaps__value">{formatValue(s.candidateValue)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
