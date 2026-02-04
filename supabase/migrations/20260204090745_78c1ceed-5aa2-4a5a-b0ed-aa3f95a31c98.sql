-- Drop the policies that try to access auth.users
DROP POLICY IF EXISTS "Super admin can view all admin requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Super admin can update admin requests" ON public.admin_requests;

-- Recreate using auth.jwt() to get email from token (no auth.users access needed)
CREATE POLICY "Super admin can view all admin requests"
ON public.admin_requests
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'aradhya1104tripathi@gmail.com'
);

CREATE POLICY "Super admin can update admin requests"
ON public.admin_requests
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'aradhya1104tripathi@gmail.com'
);