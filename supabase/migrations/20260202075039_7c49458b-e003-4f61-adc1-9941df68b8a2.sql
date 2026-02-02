-- Create a function to handle admin role assignment via trigger
-- This runs with SECURITY DEFINER privileges, bypassing RLS
CREATE OR REPLACE FUNCTION public.handle_admin_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this signup came from admin page (user metadata contains admin_signup flag)
  IF NEW.raw_user_meta_data->>'admin_signup' = 'true' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to auto-assign admin role
DROP TRIGGER IF EXISTS on_admin_signup ON auth.users;
CREATE TRIGGER on_admin_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_admin_signup();