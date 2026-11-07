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