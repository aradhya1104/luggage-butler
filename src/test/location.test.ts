import { describe, expect, it } from "vitest";
import { GPS_OPTIONS, googleMapsLocationUrl, validCoordinates } from "../lib/location";
import { pickupCoordinateFields } from "../../supabase/functions/_shared/pickup-coordinates";

describe("customer pickup coordinates", () => {
  it("requests fresh high accuracy GPS", () => {
    expect(GPS_OPTIONS.enableHighAccuracy).toBe(true);
    expect(GPS_OPTIONS.maximumAge).toBe(0);
  });
  it("generates a coordinate verification link without a key or directions", () => {
    expect(googleMapsLocationUrl({ latitude: 26.8467, longitude: 80.9462 })).toBe("https://www.google.com/maps/search/?api=1&query=26.8467,80.9462");
  });
  it("preserves exact confirmed GPS coordinates in booking fields", () => {
    expect(pickupCoordinateFields(26.8467123, 80.9462456)).toEqual({ pickup_latitude: 26.8467123, pickup_longitude: 80.9462456 });
  });
  it("allows manual-address bookings without GPS", () => {
    expect(pickupCoordinateFields(null, null)).toEqual({ pickup_latitude: null, pickup_longitude: null });
  });
  it("rejects invalid latitude", () => {
    expect(() => pickupCoordinateFields(91, 80)).toThrow();
    expect(validCoordinates({ latitude: 91, longitude: 80 })).toBe(false);
  });
  it("rejects invalid longitude", () => {
    expect(() => pickupCoordinateFields(26, -181)).toThrow();
  });
  it("rejects incomplete or nonfinite coordinates", () => {
    expect(() => pickupCoordinateFields(26, null)).toThrow();
    expect(() => pickupCoordinateFields(NaN, 80)).toThrow();
  });
});
import { parsePhotonResults, photonSearchUrl } from "../lib/location";
import { deliveryCoordinateFields } from "../../supabase/functions/_shared/pickup-coordinates";

describe("destination search", () => {
  it("limits search to India and biases near the customer", () => {
    const url = new URL(photonSearchUrl("Hazratganj", { latitude: 26.85, longitude: 80.94 }));
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api/");
    expect(url.searchParams.get("bbox")).toBe("68.1,6.5,97.4,35.7");
    expect(url.searchParams.get("lat")).toBe("26.85");
    expect(url.searchParams.get("lon")).toBe("80.94");
  });
  it("extracts name, locality, city, state and lat/lng", () => {
    const [s] = parsePhotonResults({ features: [{ geometry: { coordinates: [80.94, 26.85] }, properties: { name: "Hazratganj Metro Station", locality: "Hazratganj", city: "Lucknow", state: "Uttar Pradesh" } }] });
    expect(s.name).toBe("Hazratganj Metro Station");
    expect(s.detail).toBe("Hazratganj, Lucknow, Uttar Pradesh");
    expect(s.point).toEqual({ latitude: 26.85, longitude: 80.94 });
  });
  it("rejects invalid delivery coordinates on the server", () => {
    expect(() => deliveryCoordinateFields(200, 80)).toThrow();
    expect(deliveryCoordinateFields(null, null)).toEqual({ delivery_latitude: null, delivery_longitude: null });
  });
});
