/* Pays des données : code ISO (drapeaux), nom court, carte de la Caraïbe.
 * La carte (contours Natural Earth, jeu world-atlas 2.0.2 land-50m, domaine public) et la position de chaque pays
 * sont dans caribbean-map.json ; les points sont placés à la main (les Bermudes sont hors cadre). */
import map from "./caribbean-map.json";

export const ISO: Record<string, string> = {
  "Anguilla": "AI", "Antigua and Barbuda": "AG", "Bahamas": "BS", "Barbados": "BB", "Belize": "BZ", "Bermuda": "BM",
  "British Virgin Islands": "VG", "Cayman Islands": "KY", "Dominica": "DM", "Dominican Republic": "DO",
  "French Guiana": "GF", "Grenada": "GD", "Guadeloupe": "GP", "Jamaica": "JM", "Marie-Galante": "GP",
  "Martinique": "MQ", "Montserrat": "MS", "Saint Kitts and Nevis": "KN", "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC", "Saint-Martin": "MF", "Sint-Maarten": "SX", "St. Barth": "BL",
  "Tobago": "TT", "Trinidad and Tobago": "TT", "Turks and Caicos Islands": "TC", "US Virgin Islands": "VI",
};

export const SHORT: Record<string, string> = {
  "Antigua and Barbuda": "Antigua & Barbuda",
  "Saint Kitts and Nevis": "St. Kitts & Nevis",
  "Saint Vincent and the Grenadines": "St. Vincent & Grenadines",
  "Turks and Caicos Islands": "Turks & Caicos",
  "Saint Lucia": "St. Lucia",
  "Trinidad and Tobago": "Trinidad & Tobago",
};

export const shortName = (country: string): string => SHORT[country] ?? country;

/** Drapeau emoji (aucun octet à télécharger) ; chaîne vide si le pays est inconnu. */
export function flagEmoji(country: string): string {
  const code = ISO[country];
  if (!code) return "";
  return String.fromCodePoint(...[...code].map((ch) => 127397 + ch.charCodeAt(0)));
}

/** Nom du fichier de drapeau SVG (public/flags/xx.svg) ou null. */
export function flagFile(country: string): string | null {
  const code = ISO[country];
  return code ? `/flags/${code.toLowerCase()}.svg` : null;
}

export const CARIBBEAN_MAP = map as unknown as {
  w: number;
  h: number;
  path: string;
  pts: Record<string, [number, number]>;
};
