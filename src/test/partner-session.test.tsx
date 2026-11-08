import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PartnerPortal from "@/pages/PartnerPortal";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), maybeSingle: vi.fn(), unsubscribe: vi.fn(),
  listener: null as null | ((event: string, session: unknown) => void),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: mocks.getSession,
    onAuthStateChange: vi.fn((listener) => {
      mocks.listener = listener;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    }),
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
} }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/PartnerJobCard", () => ({ default: () => null }));

describe("partner session recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listener = null;
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });
  afterEach(cleanup);

  it("opens partner registration when the authenticated session arrives after the initial mobile check", async () => {
    render(<MemoryRouter><PartnerPortal /></MemoryRouter>);
    await screen.findByRole("button", { name: /^Sign in$/ });
    act(() => mocks.listener?.("SIGNED_IN", { user: { id: "partner-user", email: "partner@example.com", user_metadata: {} } }));
    await screen.findByRole("button", { name: "Register as partner" });
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
  });

  it("offers recovery instead of leaving the partner waiting after a failed session check", async () => {
    mocks.getSession.mockRejectedValue(new Error("Connection interrupted"));
    render(<MemoryRouter><PartnerPortal /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled());
  });
});