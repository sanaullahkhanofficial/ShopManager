import { useCallback, useMemo, useReducer } from 'react';
import type { DrinkConfiguration, WhipLevel } from '@/types/config';
import type { NutritionDatabase } from '@/types/database';
import { calculateNutrition } from '@/lib/calculator/calculateNutrition';
import { buildDefaultConfiguration } from '@/lib/calculator/defaults';

export interface CalculatorState {
  configuration: DrinkConfiguration;
  searchQuery: string;
  selectedCategory: string;
  recalcTick: number;
}

type Action =
  | { type: 'SELECT_DRINK'; drinkId: string }
  | { type: 'SET_SIZE'; sizeId: DrinkConfiguration['sizeId'] }
  | { type: 'SET_MILK'; milkId: string | null }
  | { type: 'SET_SHOTS'; shots: number }
  | { type: 'SET_SYRUP_PUMPS'; pumps: number }
  | { type: 'SET_SAUCE_PUMPS'; pumps: number }
  | { type: 'TOGGLE_SWEETENER' }
  | { type: 'TOGGLE_COLD_FOAM' }
  | { type: 'SET_WHIP'; whip: WhipLevel }
  | { type: 'TOGGLE_TOPPING'; topping: string }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_CATEGORY'; category: string }
  | { type: 'SET_CONFIGURATION'; configuration: DrinkConfiguration }
  | { type: 'RECALCULATE' }
  | { type: 'RESET'; configuration: DrinkConfiguration };

function reducer(state: CalculatorState, action: Action, database: NutritionDatabase): CalculatorState {
  switch (action.type) {
    case 'SELECT_DRINK': {
      const drink = database.drinks.find((d) => d.id === action.drinkId);
      if (!drink) return state;
      return { ...state, configuration: buildDefaultConfiguration(drink) };
    }
    case 'SET_SIZE':
      return { ...state, configuration: { ...state.configuration, sizeId: action.sizeId } };
    case 'SET_MILK':
      return { ...state, configuration: { ...state.configuration, milkId: action.milkId } };
    case 'SET_SHOTS':
      return { ...state, configuration: { ...state.configuration, espressoShots: action.shots } };
    case 'SET_SYRUP_PUMPS':
      return { ...state, configuration: { ...state.configuration, syrupPumps: action.pumps } };
    case 'SET_SAUCE_PUMPS':
      return { ...state, configuration: { ...state.configuration, saucePumps: action.pumps } };
    case 'TOGGLE_SWEETENER':
      return { ...state, configuration: { ...state.configuration, sweetener: !state.configuration.sweetener } };
    case 'TOGGLE_COLD_FOAM':
      return { ...state, configuration: { ...state.configuration, coldFoam: !state.configuration.coldFoam } };
    case 'SET_WHIP':
      return { ...state, configuration: { ...state.configuration, whip: action.whip } };
    case 'TOGGLE_TOPPING': {
      const has = state.configuration.toppings.includes(action.topping);
      const toppings = has ? state.configuration.toppings.filter((t) => t !== action.topping) : [...state.configuration.toppings, action.topping];
      return { ...state, configuration: { ...state.configuration, toppings } };
    }
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.category };
    case 'SET_CONFIGURATION':
      return { ...state, configuration: action.configuration };
    case 'RECALCULATE':
      return { ...state, recalcTick: state.recalcTick + 1 };
    case 'RESET':
      return { configuration: action.configuration, searchQuery: '', selectedCategory: 'all', recalcTick: 0 };
    default:
      return state;
  }
}

export function useCalculatorStore(database: NutritionDatabase, initial: DrinkConfiguration) {
  const [state, dispatch] = useReducer((s: CalculatorState, a: Action) => reducer(s, a, database), {
    configuration: initial,
    searchQuery: '',
    selectedCategory: 'all',
    recalcTick: 0,
  });

  const result = useMemo(() => calculateNutrition(state.configuration, database), [state.configuration, state.recalcTick, database]);

  const firstDrink = database.drinks[0];
  const reset = useCallback(() => {
    if (!firstDrink) return;
    dispatch({ type: 'RESET', configuration: buildDefaultConfiguration(firstDrink) });
  }, [firstDrink]);

  return { state, dispatch, result, reset };
}
