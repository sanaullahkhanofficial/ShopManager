import { useEffect, useRef, useState } from 'react';
import type { NutritionDatabase } from '@/types/database';
import { useCalculatorStore } from './store';
import { buildDefaultConfiguration } from '@/lib/calculator/defaults';
import { parseConfigurationFromSearchParams, configurationToSearchParams, configurationToShareUrl } from '@/lib/sharing/url';
import { saveDrink, pushRecentDrinkId, toggleFavorite, getFavoriteIds } from '@/lib/storage/localStorage';
import { DrinkPicker } from './DrinkPicker';
import { SizeSelector } from './SizeSelector';
import { MilkSelector } from './MilkSelector';
import { ShotSelector } from './ShotSelector';
import { ModifierControls } from './ModifierControls';
import { NutritionPanel } from './NutritionPanel';
import { CustomizationSummary } from './CustomizationSummary';
import { WhatChanged } from './WhatChanged';
import { SmartSwaps } from './SmartSwaps';

interface Props {
  database: NutritionDatabase;
}

export function Calculator({ database }: Props) {
  // The static dataset always ships with at least one drink; this component
  // is only ever mounted with that dataset (see src/data/us/index.ts).
  const firstDrink = database.drinks[0];
  if (!firstDrink) {
    return <p role="alert">Drink data is unavailable right now. Please try again later.</p>;
  }
  return <CalculatorReady database={database} firstDrink={firstDrink} />;
}

function CalculatorReady({ database, firstDrink }: Props & { firstDrink: NonNullable<NutritionDatabase['drinks'][number]> }) {
  const store = useCalculatorStore(database, buildDefaultConfiguration(firstDrink));
  const { state, dispatch, result, reset } = store;
  const drink = database.drinks.find((d) => d.id === state.configuration.drinkId) ?? firstDrink;

  const [saveName, setSaveName] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const hydratedFromUrl = useRef(false);

  // Restore configuration from the URL once, on mount, client-side only.
  useEffect(() => {
    if (hydratedFromUrl.current) return;
    hydratedFromUrl.current = true;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return;
    const { configuration } = parseConfigurationFromSearchParams(params, database);
    dispatch({ type: 'SET_CONFIGURATION', configuration });
  }, [database, dispatch]);

  // Keep the URL in sync with the current configuration (deep linking).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = configurationToSearchParams(result.configuration);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', next);
  }, [result.configuration]);

  useEffect(() => {
    pushRecentDrinkId(drink.id);
  }, [drink.id]);

  useEffect(() => {
    setFavorites(getFavoriteIds().value);
  }, []);

  function handleSave() {
    const name = saveName.trim() || `${drink.name} (custom)`;
    const res = saveDrink({ name, configuration: result.configuration, nutrition: result.nutrition, dataVersion: database.dataVersion });
    setSaveNotice(res.ok ? 'Saved to your device.' : (res.error ?? 'Could not save.'));
  }

  async function handleShare() {
    const url = configurationToShareUrl(result.configuration, typeof window !== 'undefined' ? window.location.href.split('?')[0]! : 'https://example.com/');
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `${drink.name} nutrition`, url });
        setShareNotice('Shared.');
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareNotice('Link copied to clipboard.');
        return;
      }
      setShareNotice(url);
    } catch {
      setShareNotice('Sharing was cancelled or is unavailable on this device.');
    }
  }

  function handleFavorite() {
    const res = toggleFavorite(drink.id);
    if (res.ok) setFavorites(res.value);
  }

  const isFavorite = favorites.includes(drink.id);

  return (
    <div className="calculator" id="calculator">
      <div className="calculator__column calculator__column--browse">
        <DrinkPicker
          database={database}
          searchQuery={state.searchQuery}
          selectedCategory={state.selectedCategory}
          selectedDrinkId={drink.id}
          onSearch={(query) => dispatch({ type: 'SET_SEARCH', query })}
          onSelectCategory={(category) => dispatch({ type: 'SET_CATEGORY', category })}
          onSelectDrink={(drinkId) => dispatch({ type: 'SELECT_DRINK', drinkId })}
        />
      </div>

      <div className="calculator__column calculator__column--customize">
        <h2 className="calculator__drink-name">{drink.name}</h2>
        <p className="calculator__drink-description">{drink.description}</p>

        <SizeSelector drink={drink} selectedSizeId={result.configuration.sizeId} onChange={(sizeId) => dispatch({ type: 'SET_SIZE', sizeId })} />
        <MilkSelector
          drink={drink}
          database={database}
          selectedMilkId={result.configuration.milkId}
          onChange={(milkId) => dispatch({ type: 'SET_MILK', milkId })}
        />
        {result.configuration.espressoShots !== null && (
          <ShotSelector drink={drink} shots={result.configuration.espressoShots} onChange={(shots) => dispatch({ type: 'SET_SHOTS', shots })} />
        )}
        <ModifierControls
          drink={drink}
          database={database}
          configuration={result.configuration}
          onSetSyrup={(pumps) => dispatch({ type: 'SET_SYRUP_PUMPS', pumps })}
          onSetSauce={(pumps) => dispatch({ type: 'SET_SAUCE_PUMPS', pumps })}
          onToggleSweetener={() => dispatch({ type: 'TOGGLE_SWEETENER' })}
          onToggleColdFoam={() => dispatch({ type: 'TOGGLE_COLD_FOAM' })}
          onSetWhip={(whip) => dispatch({ type: 'SET_WHIP', whip })}
          onToggleTopping={(topping) => dispatch({ type: 'TOGGLE_TOPPING', topping })}
        />

        <div className="calculator__actions">
          <button type="button" className="btn btn--secondary" onClick={reset}>
            Reset
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => dispatch({ type: 'RECALCULATE' })}>
            Recalculate
          </button>
        </div>
      </div>

      <div className="calculator__column calculator__column--result">
        <CustomizationSummary drink={drink} database={database} configuration={result.configuration} />
        <NutritionPanel drink={drink} result={result} />
        <WhatChanged drink={drink} database={database} configuration={result.configuration} currentNutrition={result.nutrition} />

        <div className="calculator__result-actions">
          <div className="calculator__save">
            <label htmlFor="save-name" className="visually-hidden">
              Name this drink
            </label>
            <input id="save-name" type="text" placeholder="Name this drink (optional)" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            <button type="button" className="btn btn--primary" onClick={handleSave}>
              Save
            </button>
          </div>
          <div className="calculator__row-actions">
            <button type="button" className="btn btn--secondary" onClick={handleFavorite} aria-pressed={isFavorite}>
              {isFavorite ? 'Favorited' : 'Favorite'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={handleShare}>
              Share
            </button>
          </div>
          {saveNotice && <p role="status">{saveNotice}</p>}
          {shareNotice && <p role="status">{shareNotice}</p>}
        </div>

        <SmartSwaps
          drinkId={drink.id}
          nutrition={result.nutrition}
          database={database}
          onSelectDrink={(id) => dispatch({ type: 'SELECT_DRINK', drinkId: id })}
        />
      </div>
    </div>
  );
}
