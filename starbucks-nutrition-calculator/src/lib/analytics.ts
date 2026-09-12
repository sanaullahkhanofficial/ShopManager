/**
 * Analytics event architecture.
 *
 * This defines the event *names and shapes* the product cares about, so a
 * real analytics provider can be wired in later without touching call sites.
 * By default `track()` does nothing invasive - no third-party script is
 * loaded, and no data leaves the browser. Wire a real sink by replacing
 * `sink` (for example, to call a provider's SDK) once the user has agreed to
 * that in your privacy policy.
 */

export type AnalyticsEvent =
  | { name: 'calculator_started'; drinkId: string }
  | { name: 'drink_selected'; drinkId: string; source: 'search' | 'category' | 'popular' | 'smart-swap' | 'url' | 'compare' }
  | { name: 'size_changed'; drinkId: string; sizeId: string }
  | { name: 'customization_changed'; drinkId: string; field: string; value: string | number | boolean }
  | { name: 'nutrition_viewed'; drinkId: string; calories: number | null }
  | { name: 'drink_saved'; drinkId: string }
  | { name: 'drink_shared'; drinkId: string; method: 'web-share' | 'clipboard' | 'fallback' }
  | { name: 'filter_used'; filterId: string };

type Sink = (event: AnalyticsEvent) => void;

let sink: Sink = () => {
  // No-op by default: this project ships with no analytics provider wired
  // up. Replace this function (e.g. in a small app-init module) to forward
  // events to a real, privacy-disclosed provider.
};

export function setAnalyticsSink(next: Sink): void {
  sink = next;
}

export function track(event: AnalyticsEvent): void {
  try {
    sink(event);
  } catch {
    // Analytics must never break the product.
  }
}
