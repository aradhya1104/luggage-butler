-- Add INSERT policy to user_roles table to prevent privilege escalation
-- Only the super admin can assign roles to users

CREATE POLICY "Only super admin can assign roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'aradhya1104tripathi@gmail.com'
  )
);

-- Also add UPDATE and DELETE policies for completeness
CREATE POLICY "Only super admin can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'aradhya1104tripathi@gmail.com'
  )
);

CREATE POLICY "Only super admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'aradhya1104tripathi@gmail.com'
  )
);