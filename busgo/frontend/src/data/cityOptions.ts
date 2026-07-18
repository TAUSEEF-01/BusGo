import { BD_LOCATIONS } from "./bangladeshLocations";

const CITY_ALIASES: Record<string, string[]> = {
  chattogram: ["chittagong"],
  cumilla: ["comilla"],
  barishal: ["barisal"],
  bogura: ["bogra"],
  jashore: ["jessore"],
};

export function cityKey(value: string): string {
  const key = value.trim().toLocaleLowerCase();
  for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
    if (key === canonical || aliases.includes(key)) return canonical;
  }
  return key;
}

export function citySearchText(value: string): string {
  const key = cityKey(value);
  return [value, key, ...(CITY_ALIASES[key] || [])].join(" ").toLocaleLowerCase();
}

/**
 * Merge city sources while treating common old/new spellings as the same city.
 * Items in earlier arrays win, so live trip data can take precedence over the
 * bundled Bangladesh fallback list.
 */
export function mergeCityOptions(...sources: Array<Array<string | null | undefined>>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const source of sources) {
    for (const raw of source) {
      const city = String(raw || "").trim();
      const key = cityKey(city);
      if (!city || !key || seen.has(key)) continue;
      seen.add(key);
      result.push(city);
    }
  }

  return result;
}

export const DEFAULT_CITY_OPTIONS = mergeCityOptions(
  Array.from(new Set(BD_LOCATIONS.map((location) => location.district))).sort((a, b) => a.localeCompare(b)),
);
