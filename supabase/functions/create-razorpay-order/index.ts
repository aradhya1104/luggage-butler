import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...data } = await req.json();

    if (action === 'create-order') {
      const { pickupLocation, deliveryLocation, dropOffDate, pickupDate, numberOfBags } = data;
      
      const amount = calculatePrice(numberOfBags);
      const trackingId = generateTrackingId();

      // Create booking in database
      const { data: booking, error: bookingError } = await supabaseClient
        .from('bookings')
        .insert({
          user_id: user.id,
          pickup_location: pickupLocation,
          delivery_location: deliveryLocation,
          drop_off_date: dropOffDate,
          pickup_date: pickupDate,
          number_of_bags: numberOfBags,
          amount: amount,
          tracking_id: trackingId,
          status: 'pending'
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Booking error:', bookingError);
        return new Response(
          JSON.stringify({ error: 'Failed to create booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create Razorpay order
      const razorpayOrderResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
        },
        body: JSON.stringify({
          amount: amount * 100, // Razorpay expects amount in paise
          currency: 'INR',
          receipt: booking.id,
          notes: {
            booking_id: booking.id,
            tracking_id: trackingId,
          }
        }),
      });

      const razorpayOrder = await razorpayOrderResponse.json();
      
      if (!razorpayOrderResponse.ok) {
        console.error('Razorpay error:', razorpayOrder);
        return new Response(
          JSON.stringify({ error: 'Failed to create payment order' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store payment record
      const { error: paymentError } = await supabaseClient
        .from('payments')
        .insert({
          booking_id: booking.id,
          razorpay_order_id: razorpayOrder.id,
          amount: amount,
          status: 'pending'
        });

      if (paymentError) {
        console.error('Payment record error:', paymentError);
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
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = data;

      // Verify signature
      const crypto = await import("https://deno.land/std@0.168.0/crypto/mod.ts");
      const encoder = new TextEncoder();
      const key = await crypto.crypto.subtle.importKey(
        "raw",
        encoder.encode(RAZORPAY_KEY_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const message = `${razorpayOrderId}|${razorpayPaymentId}`;
      const signature = await crypto.crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(message)
      );
      
      const expectedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = expectedSignature === razorpaySignature;

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid payment signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update payment status
      const { error: updatePaymentError } = await supabaseClient
        .from('payments')
        .update({
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
          status: 'success'
        })
        .eq('razorpay_order_id', razorpayOrderId);

      if (updatePaymentError) {
        console.error('Update payment error:', updatePaymentError);
      }

      // Update booking status
      const { data: updatedBooking, error: updateBookingError } = await supabaseClient
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

      return new Response(
        JSON.stringify({ 
          success: true, 
          booking: updatedBooking 
        }),
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
