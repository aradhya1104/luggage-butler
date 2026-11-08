export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

export function validCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Coordinates;
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
    point.latitude >= -90 && point.latitude <= 90 &&
    point.longitude >= -180 && point.longitude <= 180;
}

export function googleMapsLocationUrl(point: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}
export interface PlaceSuggestion {
  id: string;
  name: string;
  detail: string;
  label: string;
  point: Coordinates;
}

const INDIA_BBOX = "68.1,6.5,97.4,35.7";

/** Builds a Photon (OpenStreetMap) search URL limited to India, biased toward a nearby point when known. */
export function photonSearchUrl(query: string, bias?: Coordinates | null): string {
  const params = new URLSearchParams({ q: query.trim(), limit: "6", lang: "en", bbox: INDIA_BBOX });
  if (bias && validCoordinates(bias)) {
    params.set("lat", String(bias.latitude));
    params.set("lon", String(bias.longitude));
  }
  return `https://photon.komoot.io/api/?${params.toString()}`;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

/** Turns a Photon response into suggestions showing place name, locality, city and state. */
export function parsePhotonResults(data: { features?: PhotonFeature[] }): PlaceSuggestion[] {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const f of data.features ?? []) {
    const [longitude, latitude] = f.geometry?.coordinates ?? [];
    const point = { latitude: Number(latitude), longitude: Number(longitude) };
    if (!validCoordinates(point)) continue;
    const p = f.properties ?? {};
    const str = (k: string) => (typeof p[k] === "string" && p[k] ? String(p[k]) : "");
    const street = [str("housenumber"), str("street")].filter(Boolean).join(" ");
    const name = str("name") || street || str("locality") || str("city");
    if (!name) continue;
    const parts = [street !== name ? street : "", str("locality"), str("district"), str("city") || str("county"), str("state"), str("postcode")];
    const detail = parts.filter((v, i, a) => v && v !== name && a.indexOf(v) === i).join(", ");
    const label = detail ? `${name}, ${detail}` : name;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ id: `${p.osm_type ?? ""}${p.osm_id ?? out.length}`, name, detail, label, point });
  }
  return out;
}
