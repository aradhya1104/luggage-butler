-- Create admin_requests table for pending admin signups
CREATE TABLE public.admin_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

-- Super admin can view all requests
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

-- Super admin can update requests (approve/reject)
CREATE POLICY "Super admin can update admin requests"
ON public.admin_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = 'aradhya1104tripathi@gmail.com'
  )
);

-- Users can view their own request
CREATE POLICY "Users can view their own admin request"
ON public.admin_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- System can insert requests (via trigger)
CREATE POLICY "Allow insert for new requests"
ON public.admin_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Drop old trigger and create new one that creates request instead of assigning role
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this signup came from admin page
  IF NEW.raw_user_meta_data->>'admin_signup' = 'true' THEN
    -- Instead of directly assigning admin role, create a pending request
    INSERT INTO public.admin_requests (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_signup();