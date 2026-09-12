import type { Drink } from '@/types/drink';
import type { NutritionDatabase } from '@/types/database';

interface Props {
  drink: Drink;
  database: NutritionDatabase;
  selectedMilkId: string | null;
  onChange: (milkId: string) => void;
}

export function MilkSelector({ drink, database, selectedMilkId, onChange }: Props) {
  if (!drink.eligibility.milk || drink.eligibleMilkIds.length === 0) return null;
  const options = database.milks.filter((m) => drink.eligibleMilkIds.includes(m.id));

  return (
    <fieldset className="control-group">
      <legend>Milk</legend>
      <div className="pill-group" role="radiogroup" aria-label="Milk">
        {options.map((milk) => (
          <label key={milk.id} className={`pill ${milk.id === selectedMilkId ? 'pill--selected' : ''}`}>
            <input type="radio" name="milk" value={milk.id} checked={milk.id === selectedMilkId} onChange={() => onChange(milk.id)} />
            <span>{milk.name}</span>
          </label>
        ))}
      </div>
      {selectedMilkId && selectedMilkId !== drink.defaultMilkId && (
        <p className="control-note" role="status">
          Nutrition impact of this milk substitution isn&apos;t in our verified per-drink dataset yet &mdash; totals below reflect the default recipe milk.
        </p>
      )}
    </fieldset>
  );
}
