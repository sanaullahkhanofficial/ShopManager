import { describe, it, expect } from 'vitest';
import { parseUnknownConfiguration } from '@/lib/validation/validateConfig';
import { DATABASE } from '@/data/us';

describe('parseUnknownConfiguration', () => {
  it('never throws on completely garbage input', () => {
    for (const garbage of [null, undefined, 42, 'a string', [], { foo: 'bar' }, { drinkId: 123 }]) {
      expect(() => parseUnknownConfiguration(garbage, DATABASE)).not.toThrow();
    }
  });

  it('discards fields that fail type/eligibility checks and reports them', () => {
    const { configuration, discarded } = parseUnknownConfiguration({ drinkId: 'caffe-latte', sizeId: 'a-fake-size', milkId: 42 }, DATABASE);
    expect(configuration.drinkId).toBe('caffe-latte');
    expect(discarded).toContain('sizeId');
  });

  it('falls back to the first database drink when drinkId is missing entirely', () => {
    const { configuration } = parseUnknownConfiguration({}, DATABASE);
    expect(DATABASE.drinks.some((d) => d.id === configuration.drinkId)).toBe(true);
  });
});
