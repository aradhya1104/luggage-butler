export function pickupCoordinateFields(latitude: unknown, longitude: unknown) {
  if (latitude == null && longitude == null) {
    return { pickup_latitude: null, pickup_longitude: null };
  }
  if (typeof latitude !== "number" || typeof longitude !== "number" ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Invalid pickup coordinates");
  }
  return { pickup_latitude: latitude, pickup_longitude: longitude };
}