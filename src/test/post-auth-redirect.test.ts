import { beforeEach, describe, expect, it } from "vitest";
import { afterPathFromUrl, googleReturnUrl, rememberPostAuthRedirect, shouldOpenPostAuthRedirect, takePostAuthRedirect, tokensFromUrl } from "@/lib/postAuthRedirect";

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

  it("only opens a remembered page on the home page Google returns to", () => {
    expect(shouldOpenPostAuthRedirect("/")).toBe(true);
    expect(shouldOpenPostAuthRedirect("/partner")).toBe(false);
    expect(shouldOpenPostAuthRedirect("/partner/login")).toBe(false);
  });

  it("Google return address names the partner dashboard as a backup", () => {
    const url = googleReturnUrl("https://luggo.co.in", "/partner");
    expect(url).toBe("https://luggo.co.in/?after=%2Fpartner");
    expect(afterPathFromUrl(`${url}#access_token=a`)).toBe("/partner");
    expect(afterPathFromUrl("https://luggo.co.in/?after=%2F%2Fevil.com")).toBeNull();
  });

  it("reads tokens returned in the address", () => {
    expect(tokensFromUrl("https://luggo.co.in/#access_token=a&refresh_token=b")).toEqual({ access_token: "a", refresh_token: "b" });
    expect(tokensFromUrl("https://luggo.co.in/")).toBeNull();
  });
});
