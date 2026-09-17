import { createClient } from "npm:@supabase/supabase-js@2";

// Razorpay server-to-server webhook.
// - Verifies the X-Razorpay-Signature HMAC over the RAW request body.
// - Idempotent: every event id is recorded once in payment_webhook_events.
// - Only marks a booking paid for captured/authorized payments.

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const expected = await hmacHex(RAZORPAY_WEBHOOK_SECRET, rawBody);
  if (!signature || !timingSafeEqual(expected, signature)) {
    console.error("Invalid webhook signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType: string = event?.event ?? "unknown";
  const paymentEntity = event?.payload?.payment?.entity ?? null;
  const orderEntity = event?.payload?.order?.entity ?? null;

  const razorpayOrderId: string | null =
    paymentEntity?.order_id ?? orderEntity?.id ?? null;
  const razorpayPaymentId: string | null = paymentEntity?.id ?? null;

  // Stable event identity: Razorpay sends x-razorpay-event-id per delivery.
  const eventId =
    req.headers.get("x-razorpay-event-id") ??
    `${eventType}:${razorpayPaymentId ?? razorpayOrderId ?? "none"}`;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // IDEMPOTENCY GATE: insert first. A duplicate delivery hits the unique
  // constraint on event_id and we return 200 without touching any record.
  const { error: ledgerError } = await supabaseAdmin
    .from("payment_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
    });

  if (ledgerError) {
    if ((ledgerError as any).code === "23505") {
      console.log("Duplicate webhook event ignored:", eventId);
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Ledger insert error:", ledgerError);
    return new Response(JSON.stringify({ error: "Ledger error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!razorpayOrderId) {
    console.log("Webhook without order id, nothing to reconcile:", eventType);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, booking_id, status")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (!payment) {
    console.log("No payment record for order:", razorpayOrderId);
    return new Response(JSON.stringify({ ok: true, unknownOrder: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const isSuccess =
    eventType === "payment.captured" ||
    eventType === "payment.authorized" ||
    eventType === "order.paid";
  const isFailure = eventType === "payment.failed";

  if (isSuccess) {
    // Never rewrite an already-successful record.
    if (payment.status !== "success") {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "success",
          razorpay_payment_id: razorpayPaymentId ?? undefined,
        })
        .eq("id", payment.id)
        .neq("status", "success");
    }

    // Only lift a booking out of an unpaid state; never downgrade or
    // overwrite a booking already progressed by an admin.
    await supabaseAdmin
      .from("bookings")
      .update({ status: "paid" })
      .eq("id", payment.booking_id)
      .in("status", ["pending", "cod_pending"]);
  } else if (isFailure) {
    // Failures never touch the booking status.
    if (payment.status !== "success") {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          razorpay_payment_id: razorpayPaymentId ?? undefined,
        })
        .eq("id", payment.id)
        .neq("status", "success");
    }
  }

  return new Response(JSON.stringify({ ok: true, event: eventType }), {
    headers: { "Content-Type": "application/json" },
  });
});
