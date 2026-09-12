import { useMemo } from 'react';
import type { Drink } from '@/types/drink';
import type { NutritionDatabase } from '@/types/database';
import type { DrinkConfiguration } from '@/types/config';
import { calculateNutrition } from '@/lib/calculator/calculateNutrition';
import { buildDefaultConfiguration } from '@/lib/calculator/defaults';
import { computeNutritionDelta, isZeroDelta } from '@/lib/calculator/delta';
import { formatSigned } from '@/lib/format';

interface Props {
  drink: Drink;
  database: NutritionDatabase;
  configuration: DrinkConfiguration;
  currentNutrition: import('@/types/nutrition').NutritionFacts;
}

const FIELDS: { key: keyof import('@/types/nutrition').NutritionFacts; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'sugarG', label: 'Sugar', unit: 'g' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'caffeineMg', label: 'Caffeine', unit: 'mg' },
];

export function WhatChanged({ drink, database, configuration, currentNutrition }: Props) {
  const baselineResult = useMemo(() => calculateNutrition(buildDefaultConfiguration(drink), database), [drink, database]);
  const isDefault = useMemo(() => JSON.stringify(configuration) === JSON.stringify(buildDefaultConfiguration(drink)), [configuration, drink]);
  const delta = useMemo(() => computeNutritionDelta(currentNutrition, baselineResult.nutrition), [currentNutrition, baselineResult]);

  if (isDefault || isZeroDelta(delta)) return null;

  return (
    <section className="what-changed" aria-label="Compared with the standard recipe">
      <p className="what-changed__title">Compared with the standard recipe</p>
      <ul className="what-changed__grid">
        {FIELDS.map((f) => (
          <li key={f.key}>
            <span className="what-changed__label">{f.label}</span>
            <span className="what-changed__value">{formatSigned(delta[f.key], f.unit)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
