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
      "🔔 TAGADA WEBHOOK RECEIVED:",
      JSON.stringify(payload, null, 2),
    );

    // 1. Extract Order Reference from Metadata (where you send 'ref' in checkout)
    const orderRef =
      payload.metadata?.ref || payload.data?.metadata?.ref || payload.ref;

    // 2. Determine if payment was successful
    const eventType = payload.type;
    const isSuccess =
      eventType === "checkout.session.completed" ||
      eventType === "payment.succeeded" ||
      payload.data?.status === "paid";

    if (!orderRef) {
      console.log("ℹ️ Test event or missing ref. No database update needed.");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (isSuccess) {
      console.log(`✅ Payment Success for Order: ${orderRef}`);

      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      // 3. Update Order Status to 'paid' in your orders table
      const { error } = await supabaseClient
        .from("orders")
        .update({ status: "paid" })
        .eq("id", orderRef);

      if (error) throw error;
      console.log("🚀 Database updated: Order is now PAID.");
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Webhook Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
