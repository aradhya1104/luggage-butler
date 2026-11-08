# Project Notes

## Admin area structure
- The admin dashboard is a route layout: `src/components/admin/AdminLayout.tsx` guards auth (user_roles check) and renders the navy sidebar; its pages live in `src/pages/admin/` (Overview, Bookings, Partners, Storage) as children of `/admin/dashboard`. Keep new admin pages as children there so they get the sidebar and auth guard; the old standalone AdminDashboard was removed.
- Shared admin table/status helpers (`STATUS_META`, `StatusPill`, `useAdminBookings`, Excel export) live in `src/pages/admin/shared.tsx` — reuse them so status labels stay consistent across pages.
- Admin styling tokens: navy `bg-admin`/`text-admin-foreground`/`text-admin-muted` and coral `accent`, defined in `src/index.css` and `tailwind.config.ts`.
- Keep business rules shared across edge-function checkout paths in `supabase/functions/_shared/` so COD and online bookings validate consistently.
- PartnerPortal owns partner session/profile/upload state; BookingHandover uses authorized database RPCs for arrival and opposite-dashboard verification, while PartnerJobCard never directly updates booking status.
- PartnerPortal subscribes to auth changes and rechecks on browser resume; defer profile requests outside auth callbacks and bound initial loading with retry so delayed mobile sessions cannot strand partners.
- Customer GPS uses a shared coordinate helper and Leaflet picker; confirmed coordinates travel in navigation state and are validated by both checkout functions before insertion into bookings, keeping precise locations out of URL parameters and within existing booking access controls.
- Destination search uses Photon (photon.komoot.io) via src/lib/location.ts helpers; delivery coordinates are validated server-side by the shared coordinate helper, keeping search key-free.
- Google sign-in always uses `window.location.origin` as redirect_uri; the intended page is stored via `src/lib/postAuthRedirect.ts` and opened by the app-wide `PostAuthRedirect` after the session exists, because path-based return addresses left phone users on the login page.
- `src/lib/authLockFallback.ts` (imported first in `main.tsx`) lets the shared sign-in browser lock run after a short wait when another tab holds it, because frozen background tabs on phones blocked Google sign-in from finishing.
- Handover codes live in a no-client-access table and are returned only by role-filtered RPCs; verification and status enforcement are transactional database operations to prevent browser or admin bypass.
- Realtime handover notifications contain no OTPs; dashboards re-fetch authorized data on notification, resume, and bounded polling to recover missed mobile events.
