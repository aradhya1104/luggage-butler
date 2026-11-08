CREATE TABLE public.handover_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id), expiry_seconds integer NOT NULL DEFAULT 900 CHECK(expiry_seconds BETWEEN 60 AND 3600), max_attempts integer NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 10), lockout_seconds integer NOT NULL DEFAULT 900 CHECK(lockout_seconds BETWEEN 60 AND 3600));
GRANT SELECT, INSERT, UPDATE ON public.handover_settings TO authenticated;
GRANT ALL ON public.handover_settings TO service_role;
ALTER TABLE public.handover_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins configure handovers" ON public.handover_settings FOR ALL TO authenticated USING(public.is_admin((auth.jwt()->>'sub')::uuid)) WITH CHECK(public.is_admin((auth.jwt()->>'sub')::uuid));
CREATE TABLE public.booking_handovers (booking_id uuid NOT NULL REFERENCES public.bookings(id), stage text NOT NULL CHECK(stage IN ('pickup','delivery')), partner_id uuid NOT NULL REFERENCES public.delivery_partners(id), code text NOT NULL CHECK(code ~ '^[0-9]{6}$'), expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, locked_until timestamptz, verified_at timestamptz, verified_by uuid, generated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(booking_id,stage));
GRANT ALL ON public.booking_handovers TO service_role;
ALTER TABLE public.booking_handovers ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.handover_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES public.bookings(id), partner_id uuid, stage text NOT NULL, event text NOT NULL, actor_id uuid, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.handover_audit TO authenticated;
GRANT ALL ON public.handover_audit TO service_role;
ALTER TABLE public.handover_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read handover audit" ON public.handover_audit FOR SELECT TO authenticated USING(public.is_admin((auth.jwt()->>'sub')::uuid));
CREATE TABLE public.handover_notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, booking_id uuid NOT NULL REFERENCES public.bookings(id), message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.handover_notifications TO authenticated;
GRANT ALL ON public.handover_notifications TO service_role;
ALTER TABLE public.handover_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own handover notifications" ON public.handover_notifications FOR SELECT TO authenticated USING(user_id=(auth.jwt()->>'sub')::uuid);
ALTER PUBLICATION supabase_realtime ADD TABLE public.handover_notifications;
ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK(status IN ('pending','paid','cod_pending','picked_up','in_storage','in_transit','delivered','completed','cancelled'));
CREATE OR REPLACE FUNCTION public.handover_notify(p_booking uuid,p_message text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ INSERT INTO public.handover_notifications(user_id,booking_id,message) SELECT DISTINCT recipient,p_booking,p_message FROM (SELECT b.user_id recipient FROM public.bookings b WHERE b.id=p_booking UNION SELECT p.user_id FROM public.bookings b JOIN public.delivery_partners p ON p.id=b.assigned_partner_id WHERE b.id=p_booking UNION SELECT r.user_id FROM public.user_roles r WHERE r.role IN ('admin','super_admin')) recipients; $$;
REVOKE ALL ON FUNCTION public.handover_notify(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_booking_handovers(p_booking_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings; uid uuid:=(auth.jwt()->>'sub')::uuid; adm boolean; agent boolean; result jsonb;
BEGIN
SELECT * INTO b FROM public.bookings WHERE id=p_booking_id;
adm:=public.is_admin(uid); agent:=EXISTS(SELECT 1 FROM public.delivery_partners WHERE id=b.assigned_partner_id AND user_id=uid);
IF uid IS NULL OR b.id IS NULL OR NOT (adm OR agent OR b.user_id=uid) THEN RAISE EXCEPTION 'Booking access denied'; END IF;
SELECT coalesce(jsonb_object_agg(h.stage,jsonb_build_object('code',CASE WHEN h.verified_at IS NULL AND h.expires_at>now() AND (adm OR (h.stage='pickup' AND agent) OR (h.stage='delivery' AND b.user_id=uid AND NOT agent)) THEN h.code ELSE NULL END,'expires_at',h.expires_at,'locked_until',h.locked_until,'verified_at',h.verified_at,'attempts',h.attempts)), '{}'::jsonb) INTO result FROM public.booking_handovers h WHERE h.booking_id=b.id AND (h.partner_id=b.assigned_partner_id OR h.verified_at IS NOT NULL);
RETURN result || jsonb_build_object('status',b.status);
END $$;
REVOKE ALL ON FUNCTION public.get_booking_handovers(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_booking_handovers(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.booking_handover_action(p_booking_id uuid,p_stage text,p_action text,p_code text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings; h public.booking_handovers; uid uuid:=(auth.jwt()->>'sub')::uuid; agent boolean; cfg public.handover_settings; newcode text; random_value bigint; event_name text;
BEGIN
IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_stage NOT IN ('pickup','delivery') OR p_action NOT IN ('generate','verify') THEN RAISE EXCEPTION 'Invalid handover action'; END IF;
SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
agent:=EXISTS(SELECT 1 FROM public.delivery_partners WHERE id=b.assigned_partner_id AND user_id=uid AND account_status='active');
IF b.id IS NULL OR b.assigned_partner_id IS NULL THEN RAISE EXCEPTION 'An assigned partner is required'; END IF;
IF (p_action='generate' OR p_stage='delivery') AND NOT agent THEN RAISE EXCEPTION 'Only the active assigned partner can perform this action'; END IF;
IF p_action='verify' AND p_stage='pickup' AND (b.user_id<>uid OR agent) THEN RAISE EXCEPTION 'Only the booking customer can verify pickup'; END IF;
IF b.status IN ('pending','cancelled','delivered','completed') THEN RETURN jsonb_build_object('ok',false,'error','This booking is not available for handover'); END IF;
IF p_stage='delivery' AND NOT EXISTS(SELECT 1 FROM public.booking_handovers WHERE booking_id=b.id AND stage='pickup' AND verified_at IS NOT NULL) THEN RETURN jsonb_build_object('ok',false,'error','Customer must verify pickup first'); END IF;
SELECT * INTO cfg FROM public.handover_settings WHERE id=true;
cfg.expiry_seconds:=coalesce(cfg.expiry_seconds,900); cfg.max_attempts:=coalesce(cfg.max_attempts,5); cfg.lockout_seconds:=coalesce(cfg.lockout_seconds,900);
SELECT * INTO h FROM public.booking_handovers WHERE booking_id=b.id AND stage=p_stage FOR UPDATE;
IF h.verified_at IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','This handover has already been verified'); END IF;
IF h.locked_until>now() THEN RETURN jsonb_build_object('ok',false,'error','Too many incorrect attempts. Try again after '||to_char(h.locked_until AT TIME ZONE 'Asia/Kolkata','HH24:MI')||' IST'); END IF;
IF p_action='generate' THEN
IF h.partner_id=b.assigned_partner_id AND h.expires_at>now() THEN RETURN jsonb_build_object('ok',true); END IF;
LOOP random_value:=('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint; EXIT WHEN random_value<4294800000; END LOOP;
newcode:=lpad((random_value%1000000)::text,6,'0');
WHILE EXISTS(SELECT 1 FROM public.booking_handovers WHERE booking_id=b.id AND code=newcode) LOOP LOOP random_value:=('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint; EXIT WHEN random_value<4294800000; END LOOP; newcode:=lpad((random_value%1000000)::text,6,'0'); END LOOP;
INSERT INTO public.booking_handovers(booking_id,stage,partner_id,code,expires_at) VALUES(b.id,p_stage,b.assigned_partner_id,newcode,now()+make_interval(secs=>cfg.expiry_seconds)) ON CONFLICT(booking_id,stage) DO UPDATE SET partner_id=excluded.partner_id,code=excluded.code,expires_at=excluded.expires_at,attempts=0,locked_until=NULL,generated_at=now();
event_name:='generated'; PERFORM public.handover_notify(b.id,CASE WHEN p_stage='pickup' THEN 'Partner arrived. Pickup OTP is ready for customer verification.' ELSE 'Partner arrived. Delivery OTP is ready in My Bookings.' END);
ELSE
IF h.booking_id IS NULL OR h.partner_id<>b.assigned_partner_id THEN RETURN jsonb_build_object('ok',false,'error','Ask the assigned partner to generate a new OTP'); END IF;
IF h.expires_at<=now() THEN RETURN jsonb_build_object('ok',false,'error','OTP expired. Ask the partner to generate a new OTP'); END IF;
IF h.locked_until IS NOT NULL THEN UPDATE public.booking_handovers SET attempts=0,locked_until=NULL WHERE booking_id=b.id AND stage=p_stage; h.attempts:=0; END IF;
IF p_code IS NULL OR p_code !~ '^[0-9]{6}$' OR p_code<>h.code THEN
UPDATE public.booking_handovers SET attempts=h.attempts+1,locked_until=CASE WHEN h.attempts+1>=cfg.max_attempts THEN now()+make_interval(secs=>cfg.lockout_seconds) ELSE NULL END WHERE booking_id=b.id AND stage=p_stage;
INSERT INTO public.handover_audit(booking_id,partner_id,stage,event,actor_id) VALUES(b.id,b.assigned_partner_id,p_stage,'incorrect_attempt',uid);
RETURN jsonb_build_object('ok',false,'error',CASE WHEN h.attempts+1>=cfg.max_attempts THEN 'Too many incorrect attempts. Temporarily locked for '||(cfg.lockout_seconds/60)||' minutes.' ELSE 'Incorrect OTP. '||(cfg.max_attempts-h.attempts-1)||' attempts remaining.' END);
END IF;
UPDATE public.booking_handovers SET verified_at=now(),verified_by=uid WHERE booking_id=b.id AND stage=p_stage;
UPDATE public.bookings SET status=CASE WHEN p_stage='pickup' THEN 'picked_up' ELSE 'delivered' END WHERE id=b.id;
event_name:='verified'; PERFORM public.handover_notify(b.id,CASE WHEN p_stage='pickup' THEN 'Pickup verified by customer. Luggage picked up.' ELSE 'Delivery verified. Luggage delivered successfully.' END);
END IF;
INSERT INTO public.handover_audit(booking_id,partner_id,stage,event,actor_id) VALUES(b.id,b.assigned_partner_id,p_stage,event_name,uid);
RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.booking_handover_action(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.booking_handover_action(uuid,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.enforce_booking_handovers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF TG_OP='INSERT' THEN IF NEW.status IN ('picked_up','in_storage','in_transit','delivered','completed') THEN RAISE EXCEPTION 'New bookings cannot bypass OTP verification'; END IF; RETURN NEW; END IF;
IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Booking customer cannot be changed'; END IF;
IF NEW.status IS DISTINCT FROM OLD.status THEN
IF NEW.status IN ('picked_up','in_storage','in_transit','delivered','completed') AND NOT EXISTS(SELECT 1 FROM public.booking_handovers WHERE booking_id=NEW.id AND stage='pickup' AND verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Customer pickup OTP verification required'; END IF;
IF NEW.status IN ('delivered','completed') AND NOT EXISTS(SELECT 1 FROM public.booking_handovers WHERE booking_id=NEW.id AND stage='delivery' AND verified_at IS NOT NULL AND partner_id=NEW.assigned_partner_id) THEN RAISE EXCEPTION 'Assigned partner delivery OTP verification required'; END IF;
END IF;
IF NEW.assigned_partner_id IS DISTINCT FROM OLD.assigned_partner_id THEN
IF EXISTS(SELECT 1 FROM public.booking_handovers WHERE booking_id=NEW.id AND stage='delivery' AND verified_at IS NOT NULL) THEN RAISE EXCEPTION 'Cannot reassign a delivered booking'; END IF;
DELETE FROM public.booking_handovers WHERE booking_id=NEW.id AND verified_at IS NULL;
INSERT INTO public.handover_audit(booking_id,partner_id,stage,event,actor_id) VALUES(NEW.id,NEW.assigned_partner_id,'assignment','codes_invalidated',(auth.jwt()->>'sub')::uuid);
END IF;
RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_booking_handovers() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_booking_handovers BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_handovers();
CREATE OR REPLACE FUNCTION public.bookings_partner_stats() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.assigned_partner_id IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN PERFORM set_config('luggo.system','on',true); IF NEW.status='picked_up' THEN UPDATE public.delivery_partners SET total_pickups=total_pickups+1 WHERE id=NEW.assigned_partner_id; ELSIF NEW.status='delivered' THEN UPDATE public.delivery_partners SET total_deliveries=total_deliveries+1 WHERE id=NEW.assigned_partner_id; ELSIF NEW.status='completed' THEN UPDATE public.delivery_partners SET completed_jobs=completed_jobs+1 WHERE id=NEW.assigned_partner_id; END IF; PERFORM set_config('luggo.system','off',true); END IF; RETURN NEW; END $$;