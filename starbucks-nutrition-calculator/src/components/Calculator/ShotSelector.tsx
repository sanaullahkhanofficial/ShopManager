import type { Drink } from '@/types/drink';

interface Props {
  drink: Drink;
  shots: number;
  onChange: (shots: number) => void;
}

export function ShotSelector({ drink, shots, onChange }: Props) {
  if (!drink.eligibility.shots || drink.defaultEspressoShots === null) return null;
  const min = drink.minEspressoShots ?? 0;
  const max = drink.maxEspressoShots ?? min;

  return (
    <fieldset className="control-group">
      <legend>Espresso Shots</legend>
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label="Decrease espresso shots"
          disabled={shots <= min}
          onClick={() => onChange(Math.max(min, shots - 1))}
        >
          &minus;
        </button>
        <output className="stepper__value" aria-live="polite">
          {shots}
        </output>
        <button
          type="button"
          className="stepper__btn"
          aria-label="Increase espresso shots"
          disabled={shots >= max}
          onClick={() => onChange(Math.min(max, shots + 1))}
        >
          +
        </button>
      </div>
    </fieldset>
  );
}
