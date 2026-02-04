-- Drop the existing restrictive SELECT policies
DROP POLICY IF EXISTS "Super admin can view all admin requests" ON public.admin_requests;
DROP POLICY IF EXISTS "Users can view their own admin request" ON public.admin_requests;

-- Recreate as PERMISSIVE policies (either condition allows access)
CREATE POLICY "Super admin can view all admin requests"
ON public.admin_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email = 'aradhya1104tripathi@gmail.com'
  )
);

CREATE POLICY "Users can view their own admin request"
ON public.admin_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);