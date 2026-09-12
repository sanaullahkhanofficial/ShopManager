import type { CalculationResult } from '@/lib/calculator/calculateNutrition';
import type { Drink } from '@/types/drink';
import { formatValue } from '@/lib/format';

interface Props {
  drink: Drink;
  result: CalculationResult;
}

const ROWS: { key: keyof CalculationResult['nutrition']; label: string; unit: string }[] = [
  { key: 'totalFatG', label: 'Total Fat', unit: 'g' },
  { key: 'saturatedFatG', label: 'Saturated Fat', unit: 'g' },
  { key: 'transFatG', label: 'Trans Fat', unit: 'g' },
  { key: 'cholesterolMg', label: 'Cholesterol', unit: 'mg' },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg' },
  { key: 'carbohydratesG', label: 'Carbohydrates', unit: 'g' },
  { key: 'fiberG', label: 'Fiber', unit: 'g' },
  { key: 'sugarG', label: 'Sugar', unit: 'g' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'caffeineMg', label: 'Caffeine', unit: 'mg' },
];

export function NutritionPanel({ drink, result }: Props) {
  const size = drink.sizes.find((s) => s.id === result.configuration.sizeId);
  return (
    <section className="nutrition-panel" aria-label="Nutrition result" aria-live="polite">
      <header className="nutrition-panel__header">
        <p className="nutrition-panel__eyebrow">Your Drink</p>
        <h3>{drink.name}</h3>
        <p className="nutrition-panel__size">{size?.name ?? result.configuration.sizeId}</p>
      </header>

      <p className="nutrition-panel__calories">
        <span className="nutrition-panel__calories-value">{formatValue(result.nutrition.calories)}</span>
        <span className="nutrition-panel__calories-unit">calories</span>
      </p>

      <dl className="nutrition-grid">
        {ROWS.map((row) => (
          <div className="nutrition-grid__row" key={row.key}>
            <dt>{row.label}</dt>
            <dd>{formatValue(result.nutrition[row.key], ` ${row.unit}`)}</dd>
          </div>
        ))}
      </dl>

      {result.warnings.length > 0 && (
        <div className="nutrition-panel__warnings" role="status">
          <p className="nutrition-panel__warnings-title">Notes on this calculation</p>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="nutrition-panel__disclaimer">
        Nutrition is based on the selected recipe and available data. Actual values may vary based on preparation, location and ingredient availability.
        Caffeine values may be approximate where source data identifies them as approximate.
      </p>
    </section>
  );
}
