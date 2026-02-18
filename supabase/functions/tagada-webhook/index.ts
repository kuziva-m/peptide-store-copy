// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log(
      "🔔 TAGADA WEBHOOK RECEIVED:\n",
      JSON.stringify(payload, null, 2),
    );

    const eventType = payload.type || payload.event;
    if (eventType !== "order/paid") {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const tagadaOrderId = payload.data?.orderId;
    const tagadaPaymentId = payload.data?.paymentId;
    const cartToken = payload.data?.cartToken;

    if (!tagadaOrderId && !tagadaPaymentId && !cartToken) {
      throw new Error("No identifying IDs found in Tagada payload");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let supabaseOrderId = null;

    // 1. Did Tagada mirror our custom token?
    if (cartToken && cartToken.length > 10) {
      supabaseOrderId = cartToken;
    }
    // 2. Bypass API Bug: Find the order using the Tagada ID we saved during checkout
    else if (tagadaOrderId || tagadaPaymentId) {
      console.log(
        `🔍 Searching DB for Tagada ID: ${tagadaOrderId || tagadaPaymentId}`,
      );
      const { data: matchedOrder } = await supabaseClient
        .from("orders")
        .select("id")
        .or(
          `stripe_session_id.eq.${tagadaOrderId},stripe_session_id.eq.${tagadaPaymentId}`,
        )
        .single();

      if (matchedOrder) supabaseOrderId = matchedOrder.id;
    }

    if (!supabaseOrderId) {
      console.error(
        "❌ CRITICAL: Could not find matching Supabase order for this webhook.",
      );
      return new Response(JSON.stringify({ error: "Order link not found" }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    console.log(
      `✅ Link found! Tagada Event = Supabase Order ${supabaseOrderId}`,
    );

    // 3. Mark the Order as Paid!
    const { error } = await supabaseClient
      .from("orders")
      .update({ status: "paid" })
      .eq("id", supabaseOrderId);

    if (error) throw error;
    console.log("🚀 Database updated: Order is now PAID.");

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Webhook Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: corsHeaders,
    });
  }
});
