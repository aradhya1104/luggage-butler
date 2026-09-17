-- Unique tracking IDs (existing NULLs allowed, duplicates unlikely; use unique index ignoring NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS bookings_tracking_id_key ON public.bookings (tracking_id) WHERE tracking_id IS NOT NULL;

-- One payment row per Razorpay order
CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_order_id_key ON public.payments (razorpay_order_id);

-- Checkout attempt idempotency
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_user_idempotency_key ON public.bookings (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Webhook event ledger (service role only)
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  razorpay_order_id text,
  razorpay_payment_id text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook events"
ON public.payment_webhook_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));