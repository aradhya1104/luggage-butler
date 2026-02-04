-- Drop the policies that try to access auth.users
DROP POLICY IF EXISTS "Only super admin can assign roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only super admin can delete roles" ON public.user_roles;

-- Recreate using auth.jwt() to get email from token
CREATE POLICY "Only super admin can assign roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email') = 'aradhya1104tripathi@gmail.com'
);

CREATE POLICY "Only super admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'aradhya1104tripathi@gmail.com'
);

CREATE POLICY "Only super admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'aradhya1104tripathi@gmail.com'
);