/**
 * Removes accents/diacritics from a string using Unicode normalization.
 * Example: "María José" → "Maria Jose"
 */
export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalizes text for search: lowercase + remove accents.
 * Example: "María José" → "maria jose"
 */
export function normalizeForSearch(str: string): string {
  return removeAccents(str.toLowerCase());
}

/**
 * Builds a SQL LIKE pattern from a search term.
 * Example: "mar" → "%mar%"
 */
export function likePattern(term: string): string {
  return `%${normalizeForSearch(term)}%`;
}

/**
 * SQLite SQL fragment that removes accents and lowercases a column value.
 * Used in raw queries for accent-insensitive search.
 * Example: removeAccentsSql("name") → "LOWER(REPLACE(...(name)...))"
 */
export function removeAccentsSql(column: string): string {
  return `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'), 'ñ','n'), 'Á','A'), 'É','E'), 'Í','I'), 'Ó','O'), 'Ú','U'), 'Ñ','N'))`;
}
