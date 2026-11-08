import { describe, expect, it, vi } from "vitest";
import { installAuthLockFallback } from "@/lib/authLockFallback";

// A lock manager where another tab holds the sign-in lock and never lets go.
const stuckLocks = () => {
  const request = vi.fn((_name: string, _opts: LockOptions, _cb: (l: Lock | null) => unknown) =>
    new Promise((_resolve, reject) => {
      _opts.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  );
  return { request, query: vi.fn() } as unknown as LockManager;
};

describe("sign-in lock held by a frozen tab", () => {
  it("still finishes the sign-in step after waiting instead of failing", async () => {
    vi.useFakeTimers();
    const locks = stuckLocks();
    installAuthLockFallback(locks, 5000);
    const step = vi.fn(async () => "signed-in");

    const pending = locks.request("lock:sb-project-auth-token", { mode: "exclusive", signal: new AbortController().signal }, step);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(pending).resolves.toBe("signed-in");
    expect(step).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("leaves unrelated locks alone", async () => {
    const locks = stuckLocks();
    const original = locks.request;
    installAuthLockFallback(locks, 5000);
    void locks.request("other-lock", { mode: "exclusive" }, () => undefined);
    expect(original).toHaveBeenCalledWith("other-lock", { mode: "exclusive" }, expect.any(Function));
  });
});
