ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_time text,
  ADD COLUMN IF NOT EXISTS delivery_time text;

COMMENT ON COLUMN public.bookings.pickup_time IS 'Preferred pickup time (HH:MM), optional';
COMMENT ON COLUMN public.bookings.delivery_time IS 'Preferred delivery time (HH:MM), optional';