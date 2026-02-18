// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORE_ID = "store_913b2c5a8ee5";
const TAGADA_BASE_URL = "https://app.tagadapay.com";
// We define your site URL here to ensure redirects go to the right place
const SITE_URL = "https://melbournepeptides.com.au";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Parse Input
    const { customer, cart, totals } = await req.json();

    console.log("📦 STARTING CHECKOUT SESSION:", {
      items: cart.length,
      total: totals.total,
      hasCustomer: !!customer,
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 2. Fetch Tagada variant IDs from variants table
    const variantIds = cart.map((i: any) => i.variantId || i.id);

    const { data: variants, error: variantError } = await supabaseClient
      .from("variants")
      .select("id, tagada_id")
      .in("id", variantIds);

    if (variantError) {
      console.error("DB Error fetching variants:", variantError);
      throw new Error("DB Error fetching variants: " + variantError.message);
    }

    const idMap = new Map();
    if (variants) variants.forEach((v: any) => idMap.set(v.id, v.tagada_id));

    // 3. Create Order in Database
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        customer_email: customer?.email || null,
        customer_name: customer?.name || null,
        shipping_address: customer?.line1
          ? {
              line1: customer.line1,
              city: customer.city,
              state: customer.state,
              postal_code: customer.postcode,
              country: "AU",
              phone: customer.phone,
            }
          : null,
        status: "pending_details",
        total_amount: totals.total,
        shipping_cost: totals.shipping || 0,
        shipping_method: totals.shippingMethod || "standard",
        items: cart,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw new Error("DB Error: " + orderError.message);
    console.log("📝 ORDER SAVED:", order.id);

    // 4. Build Items for Tagada URL
    const items = cart.map((item: any) => {
      const vId = item.variantId || item.id;
      const tagadaId = idMap.get(vId);

      if (!tagadaId) {
        console.warn(
          `⚠️ Missing Tagada ID for Variant ${vId}. Using fallback or it may fail.`,
        );
      }

      return {
        variantId: tagadaId || "MISSING_TAGADA_ID",
        quantity: item.quantity,
      };
    });

    // 5. Construct URL with Success Redirect
    const params = new URLSearchParams({
      storeId: STORE_ID,
      currency: "AUD",
      items: JSON.stringify(items),
      ref: order.id,
      // 👇 This tells Tagada where to send them after payment
      successUrl: `${SITE_URL}/success?order_id=${order.id}`,
      // 👇 This tells Tagada where to send them if they click "Cancel"
      cancelUrl: `${SITE_URL}/shop`,
    });

    if (customer?.email) params.set("customerEmail", customer.email);
    if (customer?.phone) params.set("customerPhone", customer.phone);
    if (customer?.name) {
      const parts = customer.name.trim().split(" ");
      params.set("customerFirstName", parts[0]);
      params.set("customerLastName", parts.slice(1).join(" ") || "");
    }

    const checkoutUrl = `${TAGADA_BASE_URL}/api/public/v1/checkout/init?${params.toString()}`;
    console.log("✅ REDIRECT URL GENERATED:", checkoutUrl);

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ CRITICAL ERROR:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
