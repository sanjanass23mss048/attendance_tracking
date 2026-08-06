const ROMAN_VALUES = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
const ROMAN_NUMERALS = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];

/** Convert a positive integer to Roman numerals (1 → I, 2 → II, …). */
export function toRomanNumeral(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return String(value ?? '');

  let remaining = Math.floor(num);
  let result = '';
  for (let i = 0; i < ROMAN_VALUES.length; i += 1) {
    while (remaining >= ROMAN_VALUES[i]) {
      result += ROMAN_NUMERALS[i];
      remaining -= ROMAN_VALUES[i];
    }
  }
  return result;
}

/** Display class label as Roman numerals when the stored name is numeric (e.g. 1 → I). */
export function formatClassRoman(className) {
  const text = String(className ?? '').trim();
  if (!text) return text;
  if (/^[IVXLCDM]+$/i.test(text)) return text.toUpperCase();
  if (/^\d+$/.test(text)) return toRomanNumeral(Number(text));
  return text;
}
