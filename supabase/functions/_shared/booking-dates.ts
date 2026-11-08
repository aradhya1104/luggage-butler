export function validateBookingDates(
  dropOffDate: string,
  pickupDate: string,
  now = new Date(),
): { valid: boolean; error?: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const earliestAllowedDate = yesterday.toISOString().slice(0, 10);

  if (pickupDate < earliestAllowedDate) {
    return { valid: false, error: "Pickup date cannot be in the past" };
  }

  if (dropOffDate < pickupDate) {
    return { valid: false, error: "Drop-off date must be on or after pickup date" };
  }

  return { valid: true };
}