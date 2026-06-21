import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * i18n key coverage test (5.5)
 *
 * Ensures all namespace JSON files have the same keys
 * across Spanish (es) and English (en) locales.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.resolve(__dirname, "../../../public/locales");
const NAMESPACES = ["auth", "common", "discover", "jams", "messages", "profile"];

function deepKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...deepKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("i18n key coverage", () => {
  for (const ns of NAMESPACES) {
    it(`namespace "${ns}" has consistent keys across es/en`, () => {
      const esPath = path.join(LOCALES_DIR, "es", `${ns}.json`);
      const enPath = path.join(LOCALES_DIR, "en", `${ns}.json`);

      const esExists = fs.existsSync(esPath);
      const enExists = fs.existsSync(enPath);

      if (!esExists || !enExists) {
        // Namespace files don't exist yet for this ns — skip
        expect(esExists).toBe(true);
        expect(enExists).toBe(true);
        return;
      }

      const es = JSON.parse(fs.readFileSync(esPath, "utf-8"));
      const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));

      const esKeys = deepKeys(es).sort();
      const enKeys = deepKeys(en).sort();

      // Keys only in es
      const esOnly = esKeys.filter((k) => !enKeys.includes(k));
      // Keys only in en
      const enOnly = enKeys.filter((k) => !esKeys.includes(k));

      expect(esOnly).toEqual([]);
      expect(enOnly).toEqual([]);
    });

    it(`namespace "${ns}" translations are non-empty strings`, () => {
      const esPath = path.join(LOCALES_DIR, "es", `${ns}.json`);
      if (!fs.existsSync(esPath)) return;

      const es = JSON.parse(fs.readFileSync(esPath, "utf-8"));
      const enPath = path.join(LOCALES_DIR, "en", `${ns}.json`);
      const en = JSON.parse(fs.readFileSync(enPath, "utf-8"));

      function findEmpty(
        obj: Record<string, unknown>,
        prefix: string,
        lang: string,
      ): string[] {
        const empty: string[] = [];
        for (const [key, value] of Object.entries(obj)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (typeof value === "string" && value.trim() === "") {
            empty.push(`${lang}:${fullKey}`);
          } else if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            empty.push(
              ...findEmpty(value as Record<string, unknown>, fullKey, lang),
            );
          }
        }
        return empty;
      }

      const emptyKeys = [...findEmpty(es, "", "es"), ...findEmpty(en, "", "en")];

      expect(emptyKeys).toEqual([]);
    });
  }

  it("all 6 expected namespaces exist", () => {
    const esDir = path.join(LOCALES_DIR, "es");
    const files = fs.readdirSync(esDir).filter((f) => f.endsWith(".json"));
    const foundNamespaces = files.map((f) => f.replace(".json", ""));

    for (const ns of NAMESPACES) {
      expect(foundNamespaces).toContain(ns);
    }
  });
});
