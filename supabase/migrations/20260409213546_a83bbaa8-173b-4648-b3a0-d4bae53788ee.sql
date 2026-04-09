
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view bookings by tracking_id" ON public.bookings;

-- Create a secure function for tracking lookups
CREATE OR REPLACE FUNCTION public.get_booking_by_tracking_id(p_tracking_id text)
RETURNS TABLE (
  id uuid,
  pickup_location text,
  delivery_location text,
  drop_off_date date,
  pickup_date date,
  number_of_bags integer,
  amount integer,
  status text,
  tracking_id text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, pickup_location, delivery_location, drop_off_date, pickup_date, number_of_bags, amount, status, tracking_id, created_at
  FROM public.bookings
  WHERE bookings.tracking_id = p_tracking_id;
$$;

-- Grant execute to both anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_booking_by_tracking_id(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booking_by_tracking_id(text) TO authenticated;
