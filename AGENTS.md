# Project Notes

## Admin area structure
- The admin dashboard is a route layout: `src/components/admin/AdminLayout.tsx` guards auth (user_roles check) and renders the navy sidebar; its pages live in `src/pages/admin/` (Overview, Bookings, Partners, Storage) as children of `/admin/dashboard`. Keep new admin pages as children there so they get the sidebar and auth guard; the old standalone AdminDashboard was removed.
- Shared admin table/status helpers (`STATUS_META`, `StatusPill`, `useAdminBookings`, Excel export) live in `src/pages/admin/shared.tsx` — reuse them so status labels stay consistent across pages.
- Admin styling tokens: navy `bg-admin`/`text-admin-foreground`/`text-admin-muted` and coral `accent`, defined in `src/index.css` and `tailwind.config.ts`.
- Keep business rules shared across edge-function checkout paths in `supabase/functions/_shared/` so COD and online bookings validate consistently.
