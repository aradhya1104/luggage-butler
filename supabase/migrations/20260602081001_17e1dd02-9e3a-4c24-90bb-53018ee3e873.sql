-- 1. Drop overly permissive bookings UPDATE policy (no WITH CHECK)
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;

-- 2. Lock down has_role: callable only inside RLS/policies, not via RPC
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;