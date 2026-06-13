
-- 1. Make has_role SECURITY DEFINER to avoid recursive RLS on user_roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 2. Drop the client-side INSERT policy on payments so only service_role can insert
DROP POLICY IF EXISTS "Users can create payments for their bookings" ON public.payments;
