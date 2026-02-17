// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CONFIGURATION ---
const STORE_ID = "store_913b2c5a8ee";
const TAGADA_BASE_URL = `https://tagada.pay/checkout/${STORE_ID}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // Removed 'cart' since it was unused in this specific snippet
    const { customer, totals } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 2. Create Order in Database
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        customer_email: customer.email,
        customer_name: customer.name,
        shipping_address: {
          line1: customer.line1,
          city: customer.city,
          state: customer.state,
          postal_code: customer.postcode,
          country: "AU",
          phone: customer.phone,
        },
        status: "pending",
        total_amount: totals.total,
        shipping_cost: totals.shipping,
        shipping_method: totals.shippingMethod,
        discount_code: totals.discountUsed,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 3. CONSTRUCT REDIRECT URL
    const redirectUrl = new URL(TAGADA_BASE_URL);
    redirectUrl.searchParams.set("amount", totals.total.toFixed(2));
    redirectUrl.searchParams.set("currency", "AUD");
    redirectUrl.searchParams.set("ref", order.id);
    redirectUrl.searchParams.set("email", customer.email);

    return new Response(JSON.stringify({ url: redirectUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    // FIX: Safely handle 'unknown' error type
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
