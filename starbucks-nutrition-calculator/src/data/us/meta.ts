export const DATA_VERSION = '2026.09-seed.2';
export const LAST_REVIEWED = '2026-09-12';

/**
 * IMPORTANT - READ BEFORE EDITING DATA FILES.
 *
 * This seed dataset was compiled from publicly available Starbucks nutrition
 * figures via third-party nutrition trackers and aggregator sites (FatSecret,
 * MyNetDiary, CalorieKing, and similar), because the build environment used to
 * assemble this dataset could not reach starbucks.com directly (network
 * egress to that domain was blocked). Every record's `sourceUrl` points to
 * the canonical Starbucks nutrition page it should be checked against.
 *
 * Every record in this dataset is therefore marked `status: "needs-review"`,
 * NOT `"verified"`. Before treating any number here as production-accurate:
 *   1. Open the record's sourceUrl on starbucks.com.
 *   2. Confirm every field against the live Starbucks nutrition table.
 *   3. Flip `status` to `"verified"` and update `lastReviewed`.
 *
 * Never change a `status` to "verified" without actually checking the
 * primary source. Never fill in a `null` field with a guessed number -
 * leave it `null` (rendered as "-") until a verified source is found.
 */
export const DATA_INTEGRITY_NOTE =
  'Compiled from publicly available Starbucks nutrition data via third-party trackers; pending direct verification against starbucks.com. Treated as "needs review", not "verified".';
