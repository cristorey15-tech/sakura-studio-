import { describe, it, expect } from "vitest";
import { removeAccents, normalizeForSearch, likePattern, removeAccentsSql } from "@/lib/search";

describe("removeAccents", () => {
  it("removes basic accents from Spanish characters", () => {
    expect(removeAccents("María José")).toBe("Maria Jose");
    expect(removeAccents("áéíóú")).toBe("aeiou");
    expect(removeAccents("ÁÉÍÓÚ")).toBe("AEIOU");
  });

  it("removes tilde from ñ/Ñ", () => {
    expect(removeAccents("España")).toBe("Espana");
    expect(removeAccents("niño")).toBe("nino");
    expect(removeAccents("NIÑO")).toBe("NINO");
  });

  it("removes diaeresis (ü/Ü)", () => {
    expect(removeAccents("pingüino")).toBe("pinguino");
    expect(removeAccents("Über")).toBe("Uber");
    expect(removeAccents("Müller")).toBe("Muller");
  });

  it("leaves non-accented strings unchanged", () => {
    expect(removeAccents("hello")).toBe("hello");
    expect(removeAccents("12345")).toBe("12345");
    expect(removeAccents("ABC")).toBe("ABC");
  });

  it("handles empty strings", () => {
    expect(removeAccents("")).toBe("");
  });

  it("handles mixed content with accents and non-accents", () => {
    expect(removeAccents("Café 2024!")).toBe("Cafe 2024!");
    expect(removeAccents("José María López-García")).toBe("Jose Maria Lopez-Garcia");
  });

  it("handles Portuguese accents (ã, õ, ç)", () => {
    expect(removeAccents("coração")).toBe("coracao");
    expect(removeAccents("país")).toBe("pais");
    expect(removeAccents("canção")).toBe("cancao");
  });

  it("handles French accents", () => {
    expect(removeAccents("français")).toBe("francais");
    expect(removeAccents("être")).toBe("etre");
    expect(removeAccents("hôtel")).toBe("hotel");
    expect(removeAccents("voilà")).toBe("voila");
    expect(removeAccents("Noël")).toBe("Noel");
  });

  it("handles German characters", () => {
    expect(removeAccents("München")).toBe("Munchen");
    expect(removeAccents("Köln")).toBe("Koln");
    // ß → ss is NOT handled by NFD (ß doesn't decompose), but ACCENT_MAP handles it
    // removeAccents (pure NFD) won't convert ß to ss
    expect(removeAccents("Weiß")).toBe("Weiß");
  });

  it("handles Danish/Nordic characters", () => {
    // NFD decomposes Å (ring) but NOT ø (stroke) or æ (ligature)
    expect(removeAccents("København")).toBe("København");
    expect(removeAccents("Århus")).toBe("Arhus");  // ring above decomposes in NFD
    expect(removeAccents("værk")).toBe("værk");  // ligature does NOT decompose in NFD
  });
});

describe("normalizeForSearch", () => {
  it("lowercases and removes accents", () => {
    expect(normalizeForSearch("María José")).toBe("maria jose");
    expect(normalizeForSearch("CAFÉ")).toBe("cafe");
  });

  it("handles diaeresis (ü/Ü)", () => {
    expect(normalizeForSearch("Pingüino")).toBe("pinguino");
    expect(normalizeForSearch("Übercool")).toBe("ubercool");
  });

  it("handles German ß conversion to ss", () => {
    expect(normalizeForSearch("Weiß")).toBe("weiss");
    expect(normalizeForSearch("Straße")).toBe("strasse");
  });

  it("handles ligature expansions", () => {
    // normalizeForSearch uses ACCENT_MAP which handles æ→ae
    expect(normalizeForSearch("værk")).toBe("vaerk");
  });

  it("leaves already normalized strings unchanged", () => {
    expect(normalizeForSearch("hello world")).toBe("hello world");
  });

  it("handles empty strings", () => {
    expect(normalizeForSearch("")).toBe("");
  });

  it("normalizes complex names", () => {
    expect(normalizeForSearch("José María López-García")).toBe("jose maria lopez-garcia");
    expect(normalizeForSearch("Señorita Álvarez")).toBe("senorita alvarez");
    expect(normalizeForSearch("Müller & Fiança")).toBe("muller & fianca");
  });
});

describe("likePattern", () => {
  it("wraps term with % wildcards", () => {
    expect(likePattern("mar")).toBe("%mar%");
  });

  it("normalizes the search term", () => {
    expect(likePattern("María")).toBe("%maria%");
    expect(likePattern("CAFÉ")).toBe("%cafe%");
    expect(likePattern("Müller")).toBe("%muller%");
  });

  it("handles empty search terms", () => {
    expect(likePattern("")).toBe("%%");
  });

  it("handles special characters", () => {
    expect(likePattern("hello%world")).toBe("%hello%world%");
  });
});

describe("removeAccentsSql", () => {
  it("generates a LOWER-wrapped REPLACE chain", () => {
    const result = removeAccentsSql("name");
    expect(result.startsWith("LOWER(")).toBe(true);
    expect(result).toContain("REPLACE");
    expect(result).toContain("name");
    expect(result.endsWith(")")).toBe(true);
  });

  it("includes the column name in the SQL", () => {
    expect(removeAccentsSql("name")).toContain("name");
    expect(removeAccentsSql("phone")).toContain("phone");
    expect(removeAccentsSql("email")).toContain("email");
  });

  it("generates REPLACE calls for the accent map entries", () => {
    const result = removeAccentsSql("name");
    // Count REPLACE occurrences — should be 1 per entry in ACCENT_MAP
    const replaceCount = (result.match(/REPLACE/g) || []).length;
    expect(replaceCount).toBeGreaterThanOrEqual(60); // ~60+ accent entries
  });

  it("begins replacements with the column and ends with LOWER", () => {
    // The innermost part should be the column name, outermost LOWER
    const sql = removeAccentsSql("email");
    // Verify structure: LOWER(REPLACE(...REPLACE(email, ...), ...))
    expect(sql).toMatch(/^LOWER\(REPLACE/);
    expect(sql).toContain("email");
  });

  it("covers all expected accent character categories", () => {
    const result = removeAccentsSql("name");
    // Count total REPLACE calls to verify comprehensiveness
    const count = (result.match(/REPLACE/g) || []).length;
    // At minimum should have: 8 multi-char + ~24 lowercase + ~24 uppercase = ~56
    expect(count).toBeGreaterThanOrEqual(56);
  });
});
