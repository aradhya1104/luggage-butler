
-- Remove user self-update on bookings to prevent status/amount tampering.
-- Updates are handled by admins or by edge functions (service role).
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;

-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE, grant only where needed.
-- Trigger functions should not be callable directly via API.
REVOKE EXECUTE ON FUNCTION public.handle_admin_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- get_user_emails enforces admin check internally; restrict to authenticated only.
REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;

-- get_booking_by_tracking_id is intentionally public for unauthenticated tracking; keep as-is.
