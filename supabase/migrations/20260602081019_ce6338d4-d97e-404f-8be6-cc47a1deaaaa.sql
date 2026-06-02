REVOKE EXECUTE ON FUNCTION public.handle_admin_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_emails(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_booking_by_tracking_id(text) FROM PUBLIC, anon;
-- get_booking_by_tracking_id used by public tracking lookup; keep authenticated only? Public tracking is unauth — re-grant for both with care
GRANT EXECUTE ON FUNCTION public.get_booking_by_tracking_id(text) TO anon, authenticated;