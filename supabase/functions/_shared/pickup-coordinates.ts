function validPair(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && typeof longitude === "number" &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function pickupCoordinateFields(latitude: unknown, longitude: unknown) {
  if (latitude == null && longitude == null) {
    return { pickup_latitude: null, pickup_longitude: null };
  }
  if (!validPair(latitude, longitude)) throw new Error("Invalid pickup coordinates");
  return { pickup_latitude: latitude as number, pickup_longitude: longitude as number };
}

export function deliveryCoordinateFields(latitude: unknown, longitude: unknown) {
  if (latitude == null && longitude == null) {
    return { delivery_latitude: null, delivery_longitude: null };
  }
  if (!validPair(latitude, longitude)) throw new Error("Invalid delivery coordinates");
  return { delivery_latitude: latitude as number, delivery_longitude: longitude as number };
}
