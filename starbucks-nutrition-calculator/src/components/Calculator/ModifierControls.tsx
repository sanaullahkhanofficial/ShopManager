import type { Drink } from '@/types/drink';
import type { NutritionDatabase } from '@/types/database';
import type { DrinkConfiguration, WhipLevel } from '@/types/config';

interface Props {
  drink: Drink;
  database: NutritionDatabase;
  configuration: DrinkConfiguration;
  onSetSyrup: (pumps: number) => void;
  onSetSauce: (pumps: number) => void;
  onToggleSweetener: () => void;
  onToggleColdFoam: () => void;
  onSetWhip: (whip: WhipLevel) => void;
  onToggleTopping: (topping: string) => void;
}

const WHIP_LEVELS: WhipLevel[] = ['none', 'light', 'standard', 'extra'];
const TOPPINGS = ['Caramel Drizzle', 'Mocha Drizzle', 'Cinnamon Powder'];

function PumpStepper({ label, pumps, max, onChange }: { label: string; pumps: number; max: number; onChange: (n: number) => void }) {
  return (
    <fieldset className="control-group">
      <legend>{label}</legend>
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={pumps <= 0}
          onClick={() => onChange(Math.max(0, pumps - 1))}
        >
          &minus;
        </button>
        <output className="stepper__value" aria-live="polite">
          {pumps}
        </output>
        <button
          type="button"
          className="stepper__btn"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={pumps >= max}
          onClick={() => onChange(Math.min(max, pumps + 1))}
        >
          +
        </button>
      </div>
      {pumps > 0 && (
        <p className="control-note" role="status">
          Ingredient-level calculation unavailable for this customization &mdash; totals reflect the base recipe.
        </p>
      )}
    </fieldset>
  );
}

export function ModifierControls({
  drink,
  database,
  configuration,
  onSetSyrup,
  onSetSauce,
  onToggleSweetener,
  onToggleColdFoam,
  onSetWhip,
  onToggleTopping,
}: Props) {
  return (
    <>
      {drink.eligibility.syrup && (
        <PumpStepper label="Flavored Syrup" pumps={configuration.syrupPumps} max={database.modifiers.syrupPump.max} onChange={onSetSyrup} />
      )}
      {drink.eligibility.sauce && (
        <PumpStepper label="Flavored Sauce" pumps={configuration.saucePumps} max={database.modifiers.saucePump.max} onChange={onSetSauce} />
      )}

      {drink.eligibility.sweetener && (
        <fieldset className="control-group">
          <legend>Sweetener</legend>
          <label className="toggle">
            <input type="checkbox" checked={configuration.sweetener} onChange={onToggleSweetener} />
            <span>Add sweetener</span>
          </label>
        </fieldset>
      )}

      {drink.eligibility.coldFoam && (
        <fieldset className="control-group">
          <legend>Cold Foam</legend>
          <label className="toggle">
            <input type="checkbox" checked={configuration.coldFoam} onChange={onToggleColdFoam} />
            <span>Add cold foam</span>
          </label>
        </fieldset>
      )}

      {drink.eligibility.whip && (
        <fieldset className="control-group">
          <legend>Whipped Cream</legend>
          <div className="pill-group" role="radiogroup" aria-label="Whipped cream level">
            {WHIP_LEVELS.map((level) => (
              <label key={level} className={`pill ${configuration.whip === level ? 'pill--selected' : ''}`}>
                <input type="radio" name="whip" value={level} checked={configuration.whip === level} onChange={() => onSetWhip(level)} />
                <span style={{ textTransform: 'capitalize' }}>{level}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {drink.eligibility.topping && (
        <fieldset className="control-group">
          <legend>Toppings</legend>
          <div className="pill-group">
            {TOPPINGS.map((topping) => (
              <label key={topping} className={`pill ${configuration.toppings.includes(topping) ? 'pill--selected' : ''}`}>
                <input type="checkbox" checked={configuration.toppings.includes(topping)} onChange={() => onToggleTopping(topping)} />
                <span>{topping}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}
