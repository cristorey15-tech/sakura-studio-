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

  it("handles Portuguese and French accents", () => {
    expect(removeAccents("café")).toBe("cafe");
    expect(removeAccents("français")).toBe("francais");
    expect(removeAccents("über")).toBe("uber");
  });
});

describe("normalizeForSearch", () => {
  it("lowercases and removes accents", () => {
    expect(normalizeForSearch("María José")).toBe("maria jose");
    expect(normalizeForSearch("CAFÉ")).toBe("cafe");
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
  });
});

describe("likePattern", () => {
  it("wraps term with % wildcards", () => {
    expect(likePattern("mar")).toBe("%mar%");
  });

  it("normalizes the search term", () => {
    expect(likePattern("María")).toBe("%maria%");
    expect(likePattern("CAFÉ")).toBe("%cafe%");
  });

  it("handles empty search terms", () => {
    expect(likePattern("")).toBe("%%");
  });

  it("handles special characters", () => {
    expect(likePattern("hello%world")).toBe("%hello%world%");
  });
});

describe("removeAccentsSql", () => {
  it("wraps column with LOWER and REPLACE chain", () => {
    const result = removeAccentsSql("name");
    expect(result).toContain("LOWER");
    expect(result).toContain("REPLACE");
    expect(result).toContain("name");
  });

  it("replaces accented characters with their base equivalents", () => {
    const result = removeAccentsSql("phone");
    expect(result).toContain("'á','a'");
    expect(result).toContain("'é','e'");
    expect(result).toContain("'ñ','n'");
    expect(result).toContain("'Á','A'");
    expect(result).toContain("'É','E'");
    expect(result).toContain("'Ñ','N'");
  });

  it("works with different column names", () => {
    const nameResult = removeAccentsSql("name");
    const phoneResult = removeAccentsSql("phone");
    const emailResult = removeAccentsSql("email");

    expect(nameResult).toContain("name");
    expect(phoneResult).toContain("phone");
    expect(emailResult).toContain("email");
  });
});
