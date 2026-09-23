import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RAZORPAY_KEY_ID = (Deno.env.get('RAZORPAY_KEY_ID') ?? '').trim();
const RAZORPAY_KEY_SECRET = (Deno.env.get('RAZORPAY_KEY_SECRET') ?? '').trim();
const GOOGLE_SCRIPT_URL = Deno.env.get('GOOGLE_SHEET_WEBHOOK_URL') ?? '';

// Input validation schemas
const createOrderSchema = z.object({
  pickupLocation: z.string().min(1, "Pickup location is required").max(500, "Location too long"),
  deliveryLocation: z.string().max(500, "Location too long").optional().nullable(),
  dropOffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  numberOfBags: z.number().int("Number of bags must be an integer").min(1, "At least 1 bag required").max(10, "Maximum 10 bags allowed"),
  idempotencyKey: z.string().min(8).max(100).optional().nullable(),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)").optional().nullable(),
  deliveryTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)").optional().nullable(),
});


const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, "Order ID is required"),
  razorpayPaymentId: z.string().min(1, "Payment ID is required"),
  razorpaySignature: z.string().min(1, "Signature is required"),
});

const failPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, "Order ID is required"),
  reason: z.string().max(200).optional().nullable(),
});

// Calculate price based on number of bags
function calculatePrice(bags: number): number {
  if (bags <= 1) return 300;
  if (bags === 2) return 500;
  if (bags === 3) return 800;
  return 1200; // 4 or more bags
}

// Generate unique tracking ID
function generateTrackingId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'LUG-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create a Razorpay order (amount in rupees). Returns ok + parsed order.
async function createRazorpayOrder(
  amountRupees: number,
  bookingId: string,
  trackingId: string,
): Promise<{ ok: boolean; order: any }> {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
    },
    body: JSON.stringify({
      amount: amountRupees * 100, // paise
      currency: 'INR',
      receipt: bookingId,
      notes: { booking_id: bookingId, tracking_id: trackingId },
    }),
  });
  const order = await res.json().catch(() => null);
  return { ok: res.ok, order };
}


// Validate dates are logical (dropOff <= pickup and both not in distant past)
function validateDates(dropOffDate: string, pickupDate: string): { valid: boolean; error?: string } {
  const dropOff = new Date(dropOffDate);
  const pickup = new Date(pickupDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Allow dates from yesterday (to handle timezone differences)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dropOff < yesterday) {
    return { valid: false, error: "Drop-off date cannot be in the past" };
  }
  if (pickup < dropOff) {
    return { valid: false, error: "Pickup date must be on or after drop-off date" };
  }
  return { valid: true };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // User-scoped client: used ONLY to identify the caller and to create
    // the caller's own booking (RLS enforced).
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Service-role client: used ONLY for payment bookkeeping (payments rows
    // and the paid flag on bookings). The browser has no write access to these
    // — every write here happens after server-side signature verification.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, ...data } = body;

    if (action === 'create-order') {
      // Validate input
      const parseResult = createOrderSchema.safeParse(data);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors.map(e => e.message).join(', ') }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { pickupLocation, deliveryLocation, dropOffDate, pickupDate, numberOfBags, idempotencyKey, pickupTime, deliveryTime } = parseResult.data;

      // Validate date logic
      const dateValidation = validateDates(dropOffDate, pickupDate);
      if (!dateValidation.valid) {
        return new Response(
          JSON.stringify({ error: dateValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Amount is ALWAYS derived server-side from the bag count.
      const amount = calculatePrice(numberOfBags);

      // ---- SERVER-SIDE IDEMPOTENCY -------------------------------------
      // Repeated Pay clicks for the same checkout attempt carry the same
      // idempotencyKey. We reuse the existing booking + Razorpay order
      // instead of creating duplicates.
      if (idempotencyKey) {
        const { data: existing } = await supabaseAdmin
          .from('bookings')
          .select('id, status, tracking_id, amount')
          .eq('user_id', user.id)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existing) {
          if (existing.status === 'paid' || existing.status === 'completed') {
            return new Response(
              JSON.stringify({ alreadyPaid: true, bookingId: existing.id, trackingId: existing.tracking_id }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data: existingPayment } = await supabaseAdmin
            .from('payments')
            .select('razorpay_order_id, status')
            .eq('booking_id', existing.id)
            .neq('status', 'failed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingPayment?.razorpay_order_id) {
            // Confirm the order is still payable at Razorpay before reusing it.
            const check = await fetch(`https://api.razorpay.com/v1/orders/${existingPayment.razorpay_order_id}`, {
              headers: { 'Authorization': 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`) },
            });
            const checkOrder = await check.json().catch(() => null);
            if (check.ok && checkOrder?.status === 'created') {
              return new Response(
                JSON.stringify({
                  orderId: existingPayment.razorpay_order_id,
                  bookingId: existing.id,
                  amount: existing.amount,
                  currency: 'INR',
                  keyId: RAZORPAY_KEY_ID,
                  trackingId: existing.tracking_id,
                  reused: true,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }

          // Booking exists but has no payable order → create a fresh order for it.
          const retryOrder = await createRazorpayOrder(existing.amount, existing.id, existing.tracking_id ?? '');
          if (!retryOrder.ok) {
            return new Response(
              JSON.stringify({ error: 'Failed to create payment order' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const { error: retryPaymentError } = await supabaseAdmin
            .from('payments')
            .insert({
              booking_id: existing.id,
              razorpay_order_id: retryOrder.order.id,
              amount: existing.amount,
              status: 'pending',
            });
          if (retryPaymentError) {
            console.error('Payment record error (retry):', retryPaymentError);
            return new Response(
              JSON.stringify({ error: 'Failed to initialise payment' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({
              orderId: retryOrder.order.id,
              bookingId: existing.id,
              amount: existing.amount,
              currency: 'INR',
              keyId: RAZORPAY_KEY_ID,
              trackingId: existing.tracking_id,
              reused: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Create booking (as the user, RLS enforced) with a unique tracking id.
      // The DB enforces tracking-id uniqueness; retry on collision.
      let booking: any = null;
      let trackingId = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        trackingId = generateTrackingId();
        const { data: inserted, error: bookingError } = await supabaseClient
          .from('bookings')
          .insert({
            user_id: user.id,
            pickup_location: pickupLocation,
            delivery_location: deliveryLocation,
            drop_off_date: dropOffDate,
            pickup_date: pickupDate,
            number_of_bags: numberOfBags,
            pickup_time: pickupTime || null,
            delivery_time: deliveryTime || null,
            amount: amount,
            tracking_id: trackingId,
            status: 'pending',
            idempotency_key: idempotencyKey ?? null,
          })
          .select()
          .single();

        if (!bookingError) {
          booking = inserted;
          break;
        }

        // Duplicate idempotency key → a concurrent request already created it.
        if ((bookingError as any).code === '23505' && String((bookingError as any).message ?? '').includes('idempotency')) {
          const { data: concurrent } = await supabaseAdmin
            .from('bookings')
            .select('*')
            .eq('user_id', user.id)
            .eq('idempotency_key', idempotencyKey!)
            .maybeSingle();
          if (concurrent) {
            const { data: concurrentPayment } = await supabaseAdmin
              .from('payments')
              .select('razorpay_order_id')
              .eq('booking_id', concurrent.id)
              .neq('status', 'failed')
              .limit(1)
              .maybeSingle();
            if (concurrentPayment?.razorpay_order_id) {
              return new Response(
                JSON.stringify({
                  orderId: concurrentPayment.razorpay_order_id,
                  bookingId: concurrent.id,
                  amount: concurrent.amount,
                  currency: 'INR',
                  keyId: RAZORPAY_KEY_ID,
                  trackingId: concurrent.tracking_id,
                  reused: true,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        // Tracking id collision → loop and try another id.
        if ((bookingError as any).code === '23505') continue;

        console.error('Booking error:', bookingError);
        return new Response(
          JSON.stringify({ error: 'Failed to create booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!booking) {
        return new Response(
          JSON.stringify({ error: 'Failed to create booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create Razorpay order
      const created = await createRazorpayOrder(amount, booking.id, trackingId);
      if (!created.ok) {
        console.error('Razorpay error:', created.order);
        return new Response(
          JSON.stringify({ error: 'Failed to create payment order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const razorpayOrder = created.order;

      // Store payment record (service role — clients cannot write payments)
      const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          booking_id: booking.id,
          razorpay_order_id: razorpayOrder.id,
          amount: amount,
          status: 'pending'
        });

      if (paymentError) {
        console.error('Payment record error:', paymentError);
        return new Response(
          JSON.stringify({ error: 'Failed to initialise payment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          orderId: razorpayOrder.id,
          bookingId: booking.id,
          amount: amount,
          currency: 'INR',
          keyId: RAZORPAY_KEY_ID,
          trackingId: trackingId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify-payment') {
      // Validate input
      const parseResult = verifyPaymentSchema.safeParse(data);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error.errors);
        return new Response(
          JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors.map(e => e.message).join(', ') }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parseResult.data;

      // SECURITY: Derive trusted bookingId from the payments record by razorpay_order_id.
      // Never trust a client-supplied bookingId — that allows marking unrelated bookings as paid.
      const { data: paymentRecord, error: paymentLookupError } = await supabaseAdmin
        .from('payments')
        .select('booking_id, status, bookings!inner(user_id)')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle();

      if (paymentLookupError || !paymentRecord) {
        console.error('Payment lookup error:', paymentLookupError);
        return new Response(
          JSON.stringify({ error: 'Payment record not found for this order' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const bookingId = paymentRecord.booking_id;

      // SECURITY: the caller must own the booking behind this order.
      const ownerId = (paymentRecord as any).bookings?.user_id;
      if (ownerId !== user.id) {
        console.error('Ownership mismatch on verify-payment');
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Idempotency: already verified → return current booking, do not re-run.
      if (paymentRecord.status === 'success') {
        const { data: existingBooking } = await supabaseAdmin
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();
        return new Response(
          JSON.stringify({ success: true, alreadyVerified: true, booking: existingBooking }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signature using Web Crypto API
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(RAZORPAY_KEY_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const message = `${razorpayOrderId}|${razorpayPaymentId}`;
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(message)
      );

      const expectedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = expectedSignature === razorpaySignature;

      if (!isValid) {
        // Record the failed attempt; booking stays unpaid.
        await supabaseAdmin
          .from('payments')
          .update({ status: 'failed', razorpay_payment_id: razorpayPaymentId })
          .eq('razorpay_order_id', razorpayOrderId)
          .neq('status', 'success');

        return new Response(
          JSON.stringify({ error: 'Invalid payment signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update payment status (service role)
      const { error: updatePaymentError } = await supabaseAdmin
        .from('payments')
        .update({
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
          status: 'success'
        })
        .eq('razorpay_order_id', razorpayOrderId);

      if (updatePaymentError) {
        console.error('Update payment error:', updatePaymentError);
        return new Response(
          JSON.stringify({ error: 'Failed to record payment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update booking status ONLY after successful verification (service role)
      const { data: updatedBooking, error: updateBookingError } = await supabaseAdmin
        .from('bookings')
        .update({ status: 'paid' })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateBookingError) {
        console.error('Update booking error:', updateBookingError);
        return new Response(
          JSON.stringify({ error: 'Failed to update booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Best-effort sheet log (server-side, never exposed to client)
      if (GOOGLE_SCRIPT_URL && updatedBooking) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', user.id)
          .maybeSingle();
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            orderId: updatedBooking.tracking_id || updatedBooking.id,
            name: profile?.full_name || '',
            phone: profile?.phone || '',
            email: user.email || '',
            pickup: updatedBooking.pickup_location,
            drop: updatedBooking.delivery_location || '',
            bags: String(updatedBooking.number_of_bags),
            amount: String(updatedBooking.amount),
            time: new Date().toISOString(),
            paymentMethod: 'Online',
          }),
        }).catch(err => console.error('Sheet log failed:', err));
      }

      return new Response(
        JSON.stringify({
          success: true,
          booking: updatedBooking
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'payment-failed') {
      // Records a failed or cancelled attempt. NEVER marks anything as paid.
      const parseResult = failPaymentSchema.safeParse(data);
      if (!parseResult.success) {
        return new Response(
          JSON.stringify({ error: 'Invalid input' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { razorpayOrderId, reason } = parseResult.data;

      const { data: paymentRecord } = await supabaseAdmin
        .from('payments')
        .select('booking_id, status, bookings!inner(user_id)')
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle();

      if (!paymentRecord || (paymentRecord as any).bookings?.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Payment record not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Never downgrade a verified payment.
      if (paymentRecord.status === 'success') {
        return new Response(
          JSON.stringify({ success: true, status: 'success' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Payment marked failed:', razorpayOrderId, reason ?? '');
      const { error: failError } = await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('razorpay_order_id', razorpayOrderId)
        .neq('status', 'success');

      if (failError) {
        console.error('Mark failed error:', failError);
        return new Response(
          JSON.stringify({ error: 'Failed to record payment status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, status: 'failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
