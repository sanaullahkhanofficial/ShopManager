import { useEffect, useMemo, useRef, useState } from 'react';
import type { NutritionDatabase } from '@/types/database';
import type { DrinkConfiguration } from '@/types/config';
import type { SizeId } from '@/types/drink';
import { calculateNutrition } from '@/lib/calculator/calculateNutrition';
import { buildDefaultConfiguration } from '@/lib/calculator/defaults';
import { parseCompareFromSearchParams, compareStateToSearchParams } from '@/lib/sharing/compareUrl';
import { formatValue, formatSigned } from '@/lib/format';

interface Props {
  database: NutritionDatabase;
}

const METRICS: { key: 'calories' | 'sugarG' | 'proteinG' | 'totalFatG' | 'carbohydratesG' | 'caffeineMg' | 'sodiumMg'; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'sugarG', label: 'Sugar', unit: 'g' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'totalFatG', label: 'Fat', unit: 'g' },
  { key: 'carbohydratesG', label: 'Carbohydrates', unit: 'g' },
  { key: 'sodiumMg', label: 'Sodium', unit: 'mg' },
  { key: 'caffeineMg', label: 'Caffeine', unit: 'mg' },
];

function Side({
  label,
  database,
  configuration,
  onChangeDrink,
  onChangeSize,
  onChangeMilk,
}: {
  label: string;
  database: NutritionDatabase;
  configuration: DrinkConfiguration;
  onChangeDrink: (drinkId: string) => void;
  onChangeSize: (sizeId: SizeId) => void;
  onChangeMilk: (milkId: string) => void;
}) {
  const drink = database.drinks.find((d) => d.id === configuration.drinkId) ?? database.drinks[0]!;
  const milkOptions = database.milks.filter((m) => drink.eligibleMilkIds.includes(m.id));

  return (
    <div className="compare-side">
      <p className="section__eyebrow">{label}</p>
      <label className="visually-hidden" htmlFor={`compare-drink-${label}`}>
        {label} drink
      </label>
      <select id={`compare-drink-${label}`} value={drink.id} onChange={(e) => onChangeDrink(e.target.value)}>
        {database.drinks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <label className="visually-hidden" htmlFor={`compare-size-${label}`}>
        {label} size
      </label>
      <select id={`compare-size-${label}`} value={configuration.sizeId} onChange={(e) => onChangeSize(e.target.value as SizeId)}>
        {drink.sizes
          .filter((s) => s.available)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>

      {milkOptions.length > 0 && (
        <>
          <label className="visually-hidden" htmlFor={`compare-milk-${label}`}>
            {label} milk
          </label>
          <select id={`compare-milk-${label}`} value={configuration.milkId ?? ''} onChange={(e) => onChangeMilk(e.target.value)}>
            {milkOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

export function Compare({ database }: Props) {
  const firstDrink = database.drinks[0]!;
  const secondDrink = database.drinks[1] ?? database.drinks[0]!;
  const [a, setA] = useState<DrinkConfiguration>(buildDefaultConfiguration(firstDrink));
  const [b, setB] = useState<DrinkConfiguration>(buildDefaultConfiguration(secondDrink));
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || typeof window === 'undefined') return;
    hydrated.current = true;
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return;
    const state = parseCompareFromSearchParams(params, database);
    setA(state.a);
    setB(state.b);
  }, [database]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = compareStateToSearchParams({ a, b });
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [a, b]);

  const resultA = useMemo(() => calculateNutrition(a, database), [a, database]);
  const resultB = useMemo(() => calculateNutrition(b, database), [b, database]);
  const drinkA = database.drinks.find((d) => d.id === resultA.configuration.drinkId) ?? firstDrink;
  const drinkB = database.drinks.find((d) => d.id === resultB.configuration.drinkId) ?? secondDrink;

  function updateSide(setter: typeof setA, field: 'drink' | 'size' | 'milk', value: string) {
    setter((prev) => {
      if (field === 'drink') {
        const drink = database.drinks.find((d) => d.id === value);
        return drink ? buildDefaultConfiguration(drink) : prev;
      }
      if (field === 'size') return { ...prev, sizeId: value as SizeId };
      return { ...prev, milkId: value };
    });
  }

  return (
    <div className="compare-tool">
      <div className="compare-tool__controls">
        <Side
          label="Drink A"
          database={database}
          configuration={resultA.configuration}
          onChangeDrink={(v) => updateSide(setA, 'drink', v)}
          onChangeSize={(v) => updateSide(setA, 'size', v)}
          onChangeMilk={(v) => updateSide(setA, 'milk', v)}
        />
        <Side
          label="Drink B"
          database={database}
          configuration={resultB.configuration}
          onChangeDrink={(v) => updateSide(setB, 'drink', v)}
          onChangeSize={(v) => updateSide(setB, 'size', v)}
          onChangeMilk={(v) => updateSide(setB, 'milk', v)}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th></th>
              <th>{drinkA.name}</th>
              <th>{drinkB.name}</th>
              <th>Difference (B &minus; A)</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>{formatValue(resultA.nutrition[m.key], m.unit ? ` ${m.unit}` : '')}</td>
                <td>{formatValue(resultB.nutrition[m.key], m.unit ? ` ${m.unit}` : '')}</td>
                <td>
                  {resultA.nutrition[m.key] === null || resultB.nutrition[m.key] === null
                    ? 'Data unavailable'
                    : formatSigned(resultB.nutrition[m.key]! - resultA.nutrition[m.key]!, m.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(resultA.warnings.length > 0 || resultB.warnings.length > 0) && (
        <div className="nutrition-panel__warnings" role="status" style={{ background: 'var(--color-gold-100)', color: 'var(--color-ink-900)' }}>
          <p className="nutrition-panel__warnings-title">Notes on this comparison</p>
          <ul>
            {[...resultA.warnings, ...resultB.warnings].map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="nutrition-panel__disclaimer" style={{ color: 'var(--color-ink-500)', marginTop: 16 }}>
        Compares each drink&rsquo;s default recipe with the size and milk selected above. Espresso shots, syrup, sauce and other customizations are not included
        in this comparison &mdash; use the calculator for a fully customized result.
      </p>
    </div>
  );
}
