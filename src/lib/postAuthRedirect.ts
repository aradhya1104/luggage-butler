// Google sign-in always returns to the site root (the documented, reliable return address).
// The page the user actually wanted is remembered here and opened once the session exists.
const KEY = "luggo:post-auth-redirect";
const MAX_AGE_MS = 15 * 60 * 1000;

export const safeInternalPath = (path: string | null | undefined): string | null =>
  path && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : null;

export const rememberPostAuthRedirect = (path: string, now = Date.now()) => {
  const safe = safeInternalPath(path);
  if (!safe) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path: safe, at: now }));
  } catch {
    /* storage unavailable (private mode) — user simply lands on the home page */
  }
};

/** Returns and clears the remembered path if it is recent and safe. */
export const takePostAuthRedirect = (now = Date.now()): string | null => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number };
    if (typeof at !== "number" || now - at > MAX_AGE_MS || now < at - 60_000) return null;
    return safeInternalPath(path);
  } catch {
    return null;
  }
};

export const clearPostAuthRedirect = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Google sign-in returns to the site root, so a remembered page is only opened there.
 * Anywhere else the user is already on a page they chose (e.g. after email sign-in on the
 * partner login), and an old remembered page must not pull them away.
 */
export const shouldOpenPostAuthRedirect = (pathname: string): boolean => pathname === "/";

export const hasPendingPostAuthRedirect = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

/** Tokens the sign-in service appended to the return address, if any. */
export const tokensFromUrl = (href: string): { access_token: string; refresh_token: string } | null => {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  url.searchParams.forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  return access_token && refresh_token ? { access_token, refresh_token } : null;
};
