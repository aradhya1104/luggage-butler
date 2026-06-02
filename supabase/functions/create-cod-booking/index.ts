import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_SCRIPT_URL = Deno.env.get('GOOGLE_SHEET_WEBHOOK_URL') ?? '';

const schema = z.object({
  pickupLocation: z.string().trim().min(1).max(500),
  deliveryLocation: z.string().trim().max(500).optional().nullable(),
  dropOffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numberOfBags: z.number().int().min(1).max(10),
});

function calculatePrice(bags: number): number {
  if (bags <= 1) return 300;
  if (bags === 2) return 500;
  if (bags === 3) return 800;
  return 1200;
}

function generateTrackingId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'LUG-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.errors.map(e => e.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { pickupLocation, deliveryLocation, dropOffDate, pickupDate, numberOfBags } = parsed.data;

    // Date sanity
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (new Date(pickupDate) < yesterday) {
      return new Response(JSON.stringify({ error: 'Pickup date cannot be in the past' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (new Date(dropOffDate) < new Date(pickupDate)) {
      return new Response(JSON.stringify({ error: 'Drop-off date must be on or after pickup date' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const amount = calculatePrice(numberOfBags);
    const trackingId = generateTrackingId();

    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert({
        user_id: user.id,
        pickup_location: pickupLocation,
        delivery_location: deliveryLocation || null,
        drop_off_date: dropOffDate,
        pickup_date: pickupDate,
        number_of_bags: numberOfBags,
        amount,
        tracking_id: trackingId,
        status: 'cod_pending',
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Booking insert error:', bookingError);
      return new Response(JSON.stringify({ error: 'Failed to create booking' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Best-effort sheet log (server-side; URL never reaches client)
    if (GOOGLE_SCRIPT_URL) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name, phone')
        .eq('user_id', user.id)
        .single();
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          orderId: trackingId,
          name: profile?.full_name || '',
          phone: profile?.phone || '',
          email: user.email || '',
          pickup: pickupLocation,
          drop: deliveryLocation || '',
          bags: String(numberOfBags),
          amount: String(amount),
          time: new Date().toISOString(),
          paymentMethod: 'COD',
        }),
      }).catch(err => console.error('Sheet log failed:', err));
    }

    return new Response(JSON.stringify({ booking, trackingId, amount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});