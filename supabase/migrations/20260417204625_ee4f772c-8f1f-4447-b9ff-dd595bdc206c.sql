
-- 2. Seed the existing super admin into user_roles with super_admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE email = 'aradhya1104tripathi@gmail.com'
ON CONFLICT DO NOTHING;

-- 3. Replace hardcoded-email policies on admin_requests with role-based checks
DROP POLICY IF EXISTS "Super admin can update admin requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Super admin can view all admin requests" ON public.admin_requests;

CREATE POLICY "Super admin can update admin requests"
ON public.admin_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin can view all admin requests"
ON public.admin_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- 4. Replace hardcoded-email policies on user_roles with role-based checks
DROP POLICY IF EXISTS "Only super admin can assign roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admin can update roles" ON public.user_roles;

CREATE POLICY "Only super admin can assign roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  AND role <> 'super_admin'::public.app_role
);

CREATE POLICY "Only super admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Only super admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- 5. Restrict the public tracking RPC to minimal, non-sensitive fields
DROP FUNCTION IF EXISTS public.get_booking_by_tracking_id(text);

CREATE OR REPLACE FUNCTION public.get_booking_by_tracking_id(p_tracking_id text)
RETURNS TABLE (
  tracking_id text,
  status text,
  drop_off_date date,
  pickup_date date,
  number_of_bags integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tracking_id, status, drop_off_date, pickup_date, number_of_bags, created_at
  FROM public.bookings
  WHERE bookings.tracking_id = p_tracking_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_by_tracking_id(text) TO anon, authenticated;

-- 6. Add input validation to handle_new_user trigger function
-- IMPORTANT: This function must NEVER assign roles or permissions. Profile data only.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text := NEW.raw_user_meta_data->>'full_name';
  v_phone text := NEW.raw_user_meta_data->>'phone';
BEGIN
  IF v_full_name IS NOT NULL AND length(v_full_name) > 100 THEN
    RAISE EXCEPTION 'full_name exceeds maximum length of 100 characters';
  END IF;
  IF v_phone IS NOT NULL AND length(v_phone) > 20 THEN
    RAISE EXCEPTION 'phone exceeds maximum length of 20 characters';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^[0-9+\-\s()]*$' THEN
    RAISE EXCEPTION 'phone contains invalid characters';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, v_full_name, v_phone);
  RETURN NEW;
END;
$$;

-- 7. Add input validation to handle_admin_signup trigger function
-- IMPORTANT: This function must NEVER assign roles directly. It only records a request.
CREATE OR REPLACE FUNCTION public.handle_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text := NEW.raw_user_meta_data->>'full_name';
BEGIN
  IF NEW.raw_user_meta_data->>'admin_signup' = 'true' THEN
    IF v_full_name IS NOT NULL AND length(v_full_name) > 100 THEN
      RAISE EXCEPTION 'full_name exceeds maximum length of 100 characters';
    END IF;
    IF NEW.email IS NULL OR length(NEW.email) > 255 THEN
      RAISE EXCEPTION 'invalid email for admin signup';
    END IF;

    INSERT INTO public.admin_requests (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, v_full_name)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
