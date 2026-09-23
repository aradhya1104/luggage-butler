CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role) OR public.has_role(_user_id, 'super_admin'::app_role)
$$;

CREATE SEQUENCE IF NOT EXISTS public.partner_code_seq START 1;

CREATE TABLE public.delivery_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  partner_code text NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (length(full_name) BETWEEN 1 AND 100),
  mobile text NOT NULL CHECK (mobile ~ '^[0-9+\-\s()]{7,20}$'),
  email text CHECK (email IS NULL OR length(email) <= 255),
  address text CHECK (address IS NULL OR length(address) <= 500),
  photo_path text,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('bike','scooter','car','van','auto','other')),
  vehicle_number text NOT NULL CHECK (length(vehicle_number) BETWEEN 3 AND 20),
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  account_status text NOT NULL DEFAULT 'pending' CHECK (account_status IN ('pending','active','suspended','inactive')),
  availability_status text NOT NULL DEFAULT 'offline' CHECK (availability_status IN ('available','busy','offline')),
  total_pickups integer NOT NULL DEFAULT 0,
  total_deliveries integer NOT NULL DEFAULT 0,
  completed_jobs integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_partners TO authenticated;
GRANT ALL ON public.delivery_partners TO service_role;
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners view own profile" ON public.delivery_partners FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all partners" ON public.delivery_partners FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users register as partner" ON public.delivery_partners FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Partners update own profile" ON public.delivery_partners FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update partners" ON public.delivery_partners FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.partner_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.partner_code := 'LUGGO-AG-' || lpad(nextval('public.partner_code_seq')::text, 4, '0');
  NEW.joined_at := now();
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.verification_status := 'pending';
    NEW.account_status := 'pending';
    NEW.availability_status := 'offline';
    NEW.total_pickups := 0; NEW.total_deliveries := 0; NEW.completed_jobs := 0;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_before_insert BEFORE INSERT ON public.delivery_partners FOR EACH ROW EXECUTE FUNCTION public.partner_before_insert();

CREATE OR REPLACE FUNCTION public.partner_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.partner_code := OLD.partner_code;
  NEW.user_id := OLD.user_id;
  NEW.joined_at := OLD.joined_at;
  IF coalesce(current_setting('luggo.system', true), '') <> 'on' THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.verification_status := OLD.verification_status;
      NEW.account_status := OLD.account_status;
      NEW.total_pickups := OLD.total_pickups;
      NEW.total_deliveries := OLD.total_deliveries;
      NEW.completed_jobs := OLD.completed_jobs;
      IF OLD.account_status <> 'active' THEN
        NEW.availability_status := 'offline';
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER partner_before_update BEFORE UPDATE ON public.delivery_partners FOR EACH ROW EXECUTE FUNCTION public.partner_before_update();

CREATE TABLE public.partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('driving_licence','aadhaar','pan','vehicle_rc','other')),
  file_path text NOT NULL,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_documents TO authenticated;
GRANT ALL ON public.partner_documents TO service_role;
ALTER TABLE public.partner_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners view own documents" ON public.partner_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Partners upload own documents" ON public.partner_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND review_status = 'pending' AND EXISTS (SELECT 1 FROM public.delivery_partners p WHERE p.id = partner_id AND p.user_id = auth.uid()));
CREATE POLICY "Admins manage documents" ON public.partner_documents FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Booking assignment
ALTER TABLE public.bookings ADD COLUMN assigned_partner_id uuid REFERENCES public.delivery_partners(id) ON DELETE SET NULL;
CREATE INDEX idx_bookings_assigned_partner ON public.bookings(assigned_partner_id);

CREATE POLICY "Partners view assigned bookings" ON public.bookings FOR SELECT TO authenticated
  USING (assigned_partner_id IN (SELECT id FROM public.delivery_partners WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.bookings_validate_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_partner_id IS DISTINCT FROM OLD.assigned_partner_id AND NEW.assigned_partner_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.delivery_partners WHERE id = NEW.assigned_partner_id AND account_status = 'active') THEN
      RAISE EXCEPTION 'Only active delivery partners can be assigned';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_validate_assignment BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.bookings_validate_assignment();

CREATE OR REPLACE FUNCTION public.bookings_partner_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_partner_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM set_config('luggo.system', 'on', true);
    IF NEW.status = 'in_transit' THEN
      UPDATE public.delivery_partners SET total_pickups = total_pickups + 1 WHERE id = NEW.assigned_partner_id;
    ELSIF NEW.status = 'delivered' THEN
      UPDATE public.delivery_partners SET total_deliveries = total_deliveries + 1 WHERE id = NEW.assigned_partner_id;
    ELSIF NEW.status = 'completed' THEN
      UPDATE public.delivery_partners SET completed_jobs = completed_jobs + 1 WHERE id = NEW.assigned_partner_id;
    END IF;
    PERFORM set_config('luggo.system', 'off', true);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_partner_stats AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.bookings_partner_stats();

-- Customer-safe partner info
CREATE OR REPLACE FUNCTION public.get_booking_partner(p_booking_id uuid)
RETURNS TABLE(partner_code text, full_name text, photo_path text, vehicle_type text, vehicle_number text, mobile text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.partner_code, p.full_name, p.photo_path, p.vehicle_type, p.vehicle_number, p.mobile
  FROM public.bookings b JOIN public.delivery_partners p ON p.id = b.assigned_partner_id
  WHERE b.id = p_booking_id AND (b.user_id = auth.uid() OR public.is_admin(auth.uid()))
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_booking_partner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_booking_partner(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_before_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.partner_before_update() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bookings_validate_assignment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bookings_partner_stats() FROM anon, authenticated, public;

-- Storage policies
CREATE POLICY "Signed-in users view partner photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'partner-photos');
CREATE POLICY "Partners upload own photo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'partner-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Partners update own photo" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'partner-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Partners delete own photo" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'partner-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Partners view own documents files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'partner-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid())));
CREATE POLICY "Partners upload own documents files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'partner-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins delete documents files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'partner-documents' AND public.is_admin(auth.uid()));