import { describe, expect, it } from "vitest";
import { validateBookingDates } from "../../supabase/functions/_shared/booking-dates";

describe("booking date validation", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");

  it("allows drop-off before pickup, including the same day", () => {
    expect(validateBookingDates("2026-11-07", "2026-11-08", now).valid).toBe(true);
    expect(validateBookingDates("2026-11-07", "2026-11-07", now).valid).toBe(true);
  });

  it("rejects pickup before drop-off", () => {
    expect(validateBookingDates("2026-11-08", "2026-11-07", now)).toEqual({
      valid: false,
      error: "Pickup date must be on or after drop-off date",
    });
  });

  it("rejects drop-off dates more than one day in the past", () => {
    expect(validateBookingDates("2026-11-04", "2026-11-08", now)).toEqual({
      valid: false,
      error: "Drop-off date cannot be in the past",
    });
  });
});