// deno-lint-ignore no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // 1. Handle CORS (so Tagada can talk to us)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Grab the data Tagada sent
    const payload = await req.json();

    // 3. LOG IT (This is the most important part)
    console.log("🔔 TAGADA WEBHOOK RECEIVED:");
    console.log(JSON.stringify(payload, null, 2));

    // 4. Return 200 OK so Tagada knows we got it
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    // FIX: Safely extract the error message
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.error("Webhook Error:", errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
