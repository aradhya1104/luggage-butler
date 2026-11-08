import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BookingHandover from "@/components/BookingHandover";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/hooks/useHandoverUpdates", () => ({ useHandoverUpdates: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("opposite dashboard handovers", () => {
  it("customer submits pickup verification through the backend bound to the booking", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "cod_pending", pickup: { code: null, expires_at: new Date(Date.now() + 900000).toISOString(), verified_at: null } } });
    render(<BookingHandover bookingId="booking-123" role="customer" />);
    const input = await screen.findByRole("textbox", { name: "Enter Pickup OTP" });
    fireEvent.change(input, { target: { value: "123456" } });
    mocks.rpc.mockResolvedValueOnce({ data: { ok: true } });
    fireEvent.click(screen.getByRole("button", { name: "Verify Pickup OTP" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("booking_handover_action", { p_booking_id: "booking-123", p_stage: "pickup", p_action: "verify", p_code: "123456" }));
  });
  it("partner submits delivery verification through the backend bound to the booking", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "picked_up", pickup: { verified_at: new Date().toISOString() }, delivery: { code: null, expires_at: new Date(Date.now() + 900000).toISOString() } } });
    render(<BookingHandover bookingId="booking-456" role="partner" />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Enter Delivery OTP" }), { target: { value: "654321" } });
    mocks.rpc.mockResolvedValueOnce({ data: { ok: false, error: "Incorrect OTP" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify Delivery OTP" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("booking_handover_action", { p_booking_id: "booking-456", p_stage: "delivery", p_action: "verify", p_code: "654321" }));
  });
});