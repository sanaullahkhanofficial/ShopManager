import type { Drink, SizeId } from '@/types/drink';

interface Props {
  drink: Drink;
  selectedSizeId: SizeId;
  onChange: (sizeId: SizeId) => void;
}

export function SizeSelector({ drink, selectedSizeId, onChange }: Props) {
  return (
    <fieldset className="control-group">
      <legend>Size</legend>
      <div className="pill-group" role="radiogroup" aria-label="Size">
        {drink.sizes.map((size) => (
          <label key={size.id} className={`pill ${!size.available ? 'pill--disabled' : ''} ${size.id === selectedSizeId ? 'pill--selected' : ''}`}>
            <input
              type="radio"
              name="size"
              value={size.id}
              checked={size.id === selectedSizeId}
              disabled={!size.available}
              onChange={() => onChange(size.id)}
            />
            <span>{size.name}</span>
            <small>{size.fluidOz} fl oz</small>
            {!size.available && <small className="pill__note">Data not available</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
