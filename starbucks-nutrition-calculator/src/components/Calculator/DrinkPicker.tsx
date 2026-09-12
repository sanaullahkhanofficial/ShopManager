import { useMemo } from 'react';
import type { Drink } from '@/types/drink';
import type { NutritionDatabase } from '@/types/database';
import { searchDrinks } from '@/lib/search';
import { getActiveCategories } from '@/lib/catalog';
import { formatValue } from '@/lib/format';

interface Props {
  database: NutritionDatabase;
  searchQuery: string;
  selectedCategory: string;
  selectedDrinkId: string;
  onSearch: (query: string) => void;
  onSelectCategory: (category: string) => void;
  onSelectDrink: (drinkId: string) => void;
}

export function DrinkPicker({ database, searchQuery, selectedCategory, selectedDrinkId, onSearch, onSelectCategory, onSelectDrink }: Props) {
  const categories = useMemo(() => getActiveCategories(database), [database]);

  const filtered = useMemo(() => {
    const searched = searchDrinks(searchQuery, database.drinks, database.categories);
    if (selectedCategory === 'all') return searched;
    return searched.filter((d) => d.category === selectedCategory);
  }, [database, searchQuery, selectedCategory]);

  return (
    <div className="drink-picker">
      <label className="visually-hidden" htmlFor="drink-search">
        Search Starbucks drinks
      </label>
      <input
        id="drink-search"
        type="search"
        className="drink-picker__search"
        placeholder="Search Starbucks drinks..."
        value={searchQuery}
        onChange={(e) => onSearch(e.target.value)}
        autoComplete="off"
      />

      <div className="drink-picker__tabs" role="tablist" aria-label="Drink categories">
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === 'all'}
          className={`chip ${selectedCategory === 'all' ? 'chip--active' : ''}`}
          onClick={() => onSelectCategory('all')}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selectedCategory === c.id}
            className={`chip ${selectedCategory === c.id ? 'chip--active' : ''}`}
            onClick={() => onSelectCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ul className="drink-picker__list" aria-live="polite">
        {filtered.length === 0 && (
          <li className="drink-picker__empty">
            <p>No drinks found for &ldquo;{searchQuery}&rdquo;.</p>
            <button type="button" className="btn btn--ghost" onClick={() => onSearch('')}>
              Clear search
            </button>
          </li>
        )}
        {filtered.map((drink: Drink) => {
          const size = drink.sizes.find((s) => s.id === drink.defaultSizeId);
          const active = drink.id === selectedDrinkId;
          return (
            <li key={drink.id}>
              <button
                type="button"
                className={`drink-picker__item ${active ? 'drink-picker__item--active' : ''}`}
                onClick={() => onSelectDrink(drink.id)}
                aria-pressed={active}
              >
                <span className="drink-picker__name">{drink.name}</span>
                <span className="drink-picker__meta">{size ? `${formatValue(size.nutrition.calories, ' cal')} · ${size.name}` : 'Data unavailable'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
