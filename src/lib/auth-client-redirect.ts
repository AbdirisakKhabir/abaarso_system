/**
 * Full-page navigation after login/signup. Client `router.replace` can fail to
 * leave the auth route in the App Router; assigning `location` reloads with session applied.
 */
export function redirectAfterAuth(path: string) {
  if (typeof window === "undefined") return;
  const p = path.trim();
  if (!p.startsWith("/") || p.startsWith("//")) {
    window.location.assign("/");
    return;
  }
  window.location.assign(p);
}

/** Prevent open redirects from `?redirect=` */
export function normalizeRedirectParam(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/";
  const p = raw.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  return p;
}
