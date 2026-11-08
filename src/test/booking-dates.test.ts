import { describe, expect, it } from "vitest";
import { validateBookingDates } from "../../supabase/functions/_shared/booking-dates";

// Arguments: (dropOffDate, pickupDate). Pickup comes first; drop-off is the same day or later.
describe("booking date validation", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");

  it("allows drop-off on or after pickup", () => {
    expect(validateBookingDates("2026-11-09", "2026-11-08", now).valid).toBe(true);
    expect(validateBookingDates("2026-11-08", "2026-11-08", now).valid).toBe(true);
  });

  it("rejects drop-off before pickup", () => {
    expect(validateBookingDates("2026-11-07", "2026-11-08", now)).toEqual({
      valid: false,
      error: "Drop-off date must be on or after pickup date",
    });
  });

  it("rejects pickup dates more than one day in the past", () => {
    expect(validateBookingDates("2026-11-08", "2026-11-04", now)).toEqual({
      valid: false,
      error: "Pickup date cannot be in the past",
    });
  });
});
