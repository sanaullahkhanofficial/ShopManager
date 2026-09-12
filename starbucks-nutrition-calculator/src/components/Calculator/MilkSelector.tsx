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
      {selectedMilkId && selectedMilkId !== drink.defaultMilkId && drink.milkVariants?.[selectedMilkId] && (
        <p className="control-note" role="status">
          Nutrition below reflects this drink made with the selected milk, as its own verified figure (not an estimated delta).
        </p>
      )}
    </fieldset>
  );
}
