// Sign-in shares one browser lock across every open tab of the site. On phones a frozen
// background tab can keep that lock forever, so every sign-in step in the visible tab
// times out ("signal is aborted without reason") and Google sign-in never finishes.
// This lets the sign-in lock wait a few seconds for other tabs, then carry on without it.

const AUTH_LOCK_PREFIX = "lock:sb-";
export const AUTH_LOCK_WAIT_MS = 5000;

type LockCallback = (lock: Lock | null) => unknown;

export function installAuthLockFallback(locks: LockManager | undefined = globalThis.navigator?.locks, waitMs = AUTH_LOCK_WAIT_MS) {
  if (!locks || typeof locks.request !== "function") return;
  const marked = locks as LockManager & { __luggoAuthFallback?: boolean };
  if (marked.__luggoAuthFallback) return;
  marked.__luggoAuthFallback = true;

  const original = locks.request.bind(locks) as (...args: unknown[]) => Promise<unknown>;

  (locks as { request: unknown }).request = (name: unknown, options: unknown, callback?: unknown) => {
    const opts = options as LockOptions | undefined;
    const isAuthWait =
      typeof name === "string" &&
      name.startsWith(AUTH_LOCK_PREFIX) &&
      typeof callback === "function" &&
      typeof opts === "object" &&
      opts !== null &&
      !opts.ifAvailable &&
      !opts.steal;
    if (!isAuthWait) return original(name, options, callback);

    const cb = callback as LockCallback;
    const { signal: callerSignal, ...rest } = opts;
    const inner = new AbortController();

    return new Promise((resolve, reject) => {
      let started = false;
      const run = (lock: Lock | null) => {
        if (started) return undefined; // the other path already ran the sign-in step
        started = true;
        clearTimeout(timer);
        const result = Promise.resolve().then(() => cb(lock));
        result.then(resolve, reject);
        return result;
      };

      // Another tab is holding the lock too long: run without it instead of failing.
      const timer = setTimeout(() => {
        if (started) return;
        inner.abort();
        run({ name, mode: "exclusive" } as Lock);
      }, waitMs);

      callerSignal?.addEventListener("abort", () => {
        if (started) return;
        inner.abort();
        run({ name, mode: "exclusive" } as Lock);
      });

      original(name, { ...rest, signal: inner.signal }, (lock: Lock | null) => run(lock)).catch(() => {
        /* aborted because we already continued without the lock */
      });
    });
  };
}

installAuthLockFallback();
