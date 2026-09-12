import { describe, it, expect } from 'vitest';
import { configurationToSearchParams, parseConfigurationFromSearchParams } from '@/lib/sharing/url';
import { DATABASE, DRINK_BY_ID } from '@/data/us';
import { buildDefaultConfiguration } from '@/lib/calculator/defaults';

describe('URL configuration round-trip', () => {
  it('reconstructs the same configuration after serializing to a URL and parsing it back', () => {
    const drink = DRINK_BY_ID['caffe-mocha']!;
    const original = { ...buildDefaultConfiguration(drink), espressoShots: 3, whip: 'standard' as const };
    const params = configurationToSearchParams(original);
    const { configuration } = parseConfigurationFromSearchParams(params, DATABASE);
    expect(configuration).toEqual(original);
  });

  it('never crashes on malformed URL parameters and discards invalid values', () => {
    const params = new URLSearchParams('drink=caffe-latte&size=xxlarge&shots=not-a-number&milk=unicorn');
    expect(() => parseConfigurationFromSearchParams(params, DATABASE)).not.toThrow();
    const { configuration, discarded } = parseConfigurationFromSearchParams(params, DATABASE);
    expect(configuration.drinkId).toBe('caffe-latte');
    expect(discarded.length).toBeGreaterThan(0);
  });

  it('falls back to a default drink for a completely empty or unknown query string', () => {
    const params = new URLSearchParams('drink=totally-unknown-drink');
    const { configuration } = parseConfigurationFromSearchParams(params, DATABASE);
    expect(DATABASE.drinks.some((d) => d.id === configuration.drinkId)).toBe(true);
  });
});
