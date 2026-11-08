import { beforeEach, describe, expect, it } from "vitest";
import { rememberPostAuthRedirect, takePostAuthRedirect, tokensFromUrl } from "@/lib/postAuthRedirect";

describe("post sign-in return page", () => {
  beforeEach(() => localStorage.clear());

  it("partner Google sign-in reopens /partner once", () => {
    rememberPostAuthRedirect("/partner", 1000);
    expect(takePostAuthRedirect(2000)).toBe("/partner");
    expect(takePostAuthRedirect(3000)).toBeNull();
  });

  it("ignores a remembered page older than 15 minutes", () => {
    rememberPostAuthRedirect("/partner", 0);
    expect(takePostAuthRedirect(15 * 60 * 1000 + 1)).toBeNull();
  });

  it("never sends users to another website", () => {
    rememberPostAuthRedirect("//evil.com", 0);
    expect(takePostAuthRedirect(1)).toBeNull();
  });

  it("reads tokens returned in the address", () => {
    expect(tokensFromUrl("https://luggo.co.in/#access_token=a&refresh_token=b")).toEqual({ access_token: "a", refresh_token: "b" });
    expect(tokensFromUrl("https://luggo.co.in/")).toBeNull();
  });
});
