/**
 * Helper to determine if an array of MCQ options should be displayed
 * as a vertical 1-column stack instead of a 2-column grid.
 * @param {Array<string>} options - List of option strings
 * @returns {boolean} true if options require single-column vertical layout
 */
export function isLongOptionsLayout(options = []) {
  if (!Array.isArray(options) || options.length === 0) return false;
  const totalOptionsLength = options.reduce((acc, opt) => acc + (opt || '').length, 0);
  return totalOptionsLength > 100 || options.some(o => (o || '').length > 40);
}
