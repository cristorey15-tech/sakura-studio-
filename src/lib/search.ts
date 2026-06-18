/**
 * Comprehensive mapping of accented characters to their base equivalents.
 * Covers: Spanish, Portuguese, French, German, Italian, Catalan, Nordic, Turkish, and more.
 */
const ACCENT_MAP: Record<string, string> = {
  // --- Lowercase vowels ---
  // Acute
  "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ý": "y",
  // Grave
  "à": "a", "è": "e", "ì": "i", "ò": "o", "ù": "u",
  // Circumflex
  "â": "a", "ê": "e", "î": "i", "ô": "o", "û": "u",
  // Diaeresis / Umlaut
  "ä": "a", "ë": "e", "ï": "i", "ö": "o", "ü": "u", "ÿ": "y",
  // Tilde
  "ã": "a", "õ": "o", "ñ": "n",
  // Ring
  "å": "a",
  // Stroke
  "ø": "o",
  // Ligatures
  "æ": "ae", "œ": "oe",
  // --- Lowercase consonants ---
  "ç": "c",
  "ğ": "g",
  "ş": "s",
  "ı": "i",

  // --- Uppercase vowels ---
  // Acute
  "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ý": "Y",
  // Grave
  "À": "A", "È": "E", "Ì": "I", "Ò": "O", "Ù": "U",
  // Circumflex
  "Â": "A", "Ê": "E", "Î": "I", "Ô": "O", "Û": "U",
  // Diaeresis / Umlaut
  "Ä": "A", "Ë": "E", "Ï": "I", "Ö": "O", "Ü": "U", "Ÿ": "Y",
  // Tilde
  "Ã": "A", "Õ": "O", "Ñ": "N",
  // Ring
  "Å": "A",
  // Stroke
  "Ø": "O",
  // Ligatures
  "Æ": "AE", "Œ": "OE",
  // --- Uppercase consonants ---
  "Ç": "C",
  "Ğ": "G",
  "Ş": "S",
  "İ": "I",
  // Eszett (German sharp s)
  "ß": "ss",

  // Additional European characters
  "Ð": "D", "ð": "d",
  "Þ": "Th", "þ": "th",
};

/** Characters where accent → multiple chars (æ→ae, ß→ss, etc.) */
const MULTI_CHAR_ACCENTS = new Set(["æ", "œ", "Æ", "Œ", "ß", "Þ", "þ", "Ð"]);

/**
 * Removes accents/diacritics from a string using Unicode normalization (NFD).
 * Covers ALL Unicode accented characters, not just those in ACCENT_MAP.
 * Example: "María José" → "Maria Jose", "über" → "uber", "français" → "francais"
 */
export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalizes text for search: lowercase + remove accents + expand ligatures.
 * Uses the comprehensive ACCENT_MAP for consistency with SQL-side normalization.
 * Falls back to NFD + strip combining marks for coverage of rare characters.
 * Example: "María José" → "maria jose", "CAFÉ" → "cafe"
 */
export function normalizeForSearch(str: string): string {
  // First, expand multi-char accents (æ→ae, ß→ss, etc.) — NFD doesn't decompose these
  let result = "";
  for (const ch of str.toLowerCase()) {
    result += ACCENT_MAP[ch] || ch;
  }
  // Then strip any remaining combining marks via NFD (catches rare characters not in ACCENT_MAP)
  return result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Builds a SQL LIKE pattern from a search term.
 * Example: "mar" → "%mar%"
 */
export function likePattern(term: string): string {
  return `%${normalizeForSearch(term)}%`;
}

/**
 * Generates a SQLite-compatible SQL expression that removes accents from a column
 * and lowercases it. Uses nested REPLACE calls generated from the ACCENT_MAP.
 *
 * Generated expression example (simplified):
 *   LOWER(REPLACE(REPLACE(name, 'á','a'), 'é','e', ...))
 *
 * @param column - The column name to wrap (e.g. "name", "phone", "email")
 * @returns A SQL fragment like: LOWER(REPLACE(REPLACE(...column...)))
 */
export function removeAccentsSql(column: string): string {
  // Build SQL with all REPLACE calls in a deterministic order:
  // 1. Multi-char replacements first (æ→ae, ß→ss, etc.)
  // 2. Then lowercase single-char replacements (á→a, etc.)
  // 3. Then uppercase single-char replacements (Á→A, etc.)
  // LOWER wraps everything at the end for case-insensitive comparison.
  const entries = Object.entries(ACCENT_MAP);

  let sql = column;

  for (const [from, to] of entries) {
    if (MULTI_CHAR_ACCENTS.has(from)) {
      sql = `REPLACE(${sql}, '${from}', '${to}')`;
    }
  }
  for (const [from, to] of entries) {
    if (!MULTI_CHAR_ACCENTS.has(from) && from === from.toLowerCase() && to.length === 1) {
      sql = `REPLACE(${sql}, '${from}', '${to}')`;
    }
  }
  for (const [from, to] of entries) {
    if (!MULTI_CHAR_ACCENTS.has(from) && from === from.toUpperCase() && from !== from.toLowerCase() && to.length === 1) {
      sql = `REPLACE(${sql}, '${from}', '${to}')`;
    }
  }

  // Wrap in LOWER to make the comparison case-insensitive
  return `LOWER(${sql})`;
}
