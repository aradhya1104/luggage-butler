CREATE OR REPLACE FUNCTION public.get_partner_job_customers()
RETURNS TABLE(booking_id uuid, full_name text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, p.full_name, p.phone
  FROM public.bookings b
  JOIN public.delivery_partners dp ON dp.id = b.assigned_partner_id
  LEFT JOIN public.profiles p ON p.user_id = b.user_id
  WHERE dp.user_id = (auth.jwt() ->> 'sub')::uuid
    AND b.status NOT IN ('completed','cancelled');
$$;
REVOKE EXECUTE ON FUNCTION public.get_partner_job_customers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_job_customers() TO authenticated;