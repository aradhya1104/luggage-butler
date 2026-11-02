CREATE TABLE public.booking_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.booking_status_logs TO authenticated;
GRANT ALL ON public.booking_status_logs TO service_role;

ALTER TABLE public.booking_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view booking status logs"
  ON public.booking_status_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_status_logs (booking_id, status)
    VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_status_change
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- Backfill: record each booking's current status as its first history entry
INSERT INTO public.booking_status_logs (booking_id, status, created_at)
SELECT id, status, updated_at FROM public.bookings;
