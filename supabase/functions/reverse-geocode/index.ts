import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      isNaN(latitude) ||
      isNaN(longitude)
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing coordinates" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing Maps credentials" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const latlng = `${latitude},${longitude}`;
    const response = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?latlng=${encodeURIComponent(latlng)}`,
      {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const details = await response.text();
      return new Response(
        JSON.stringify({ error: "Geocoding failed", details }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const address = data.results?.[0]?.formatted_address;

    if (!address) {
      return new Response(
        JSON.stringify({
          address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ address }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
