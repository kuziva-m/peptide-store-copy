// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORE_ID = "store_913b2c5a8ee5";
// We switch to the standard session creation endpoint
const TAGADA_API_URL =
  "https://app.tagadapay.com/api/public/v1/checkout/sessions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { customer, cart, totals } = await req.json();

    // FIX 1: Ensure total is a clean number (2 decimal places)
    const cleanTotal = parseFloat(totals.total.toFixed(2));
    console.log(
      `📦 STARTING SESSION: Order for ${customer.email} | Total: ${cleanTotal}`,
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Fetch Tagada IDs
    const productIds = cart.map((i: any) => i.id);
    const { data: products } = await supabaseClient
      .from("products")
      .select("id, tagada_id")
      .in("id", productIds);

    const idMap = new Map();
    if (products) products.forEach((p: any) => idMap.set(p.id, p.tagada_id));

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
        status: "pending_contact",
        total_amount: cleanTotal,
        shipping_cost: totals.shipping,
        shipping_method: totals.shippingMethod,
        discount_code: totals.discountUsed,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw new Error("DB Error: " + orderError.message);

    // 3. Request Session via POST (Standard Auth)
    const TAGADA_SECRET = Deno.env.get("TAGADA_SECRET");

    const response = await fetch(TAGADA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAGADA_SECRET}`,
      },
      body: JSON.stringify({
        storeId: STORE_ID,
        currency: "AUD",
        amount: Math.round(cleanTotal * 100), // Tagada usually expects cents
        referenceId: order.id,
        customer: {
          email: customer.email,
          firstName: customer.name.split(" ")[0],
          lastName: customer.name.split(" ").slice(1).join(" ") || "Customer",
          phone: customer.phone,
        },
        items: cart.map((item: any) => ({
          variantId: idMap.get(item.id) || "product_48dbbd586dbe",
          quantity: item.quantity,
        })),
        successUrl: `https://melbournepeptides.com.au/success?order_id=${order.id}`,
        cancelUrl: `https://melbournepeptides.com.au/checkout`,
        metadata: {
          ref: order.id, // Ensuring this is stored for the webhook
        },
      }),
    });

    const sessionData = await response.json();

    if (!response.ok) {
      console.error("❌ TAGADA API REJECTED REQUEST:", sessionData);
      throw new Error(sessionData.message || "Tagada API Error");
    }

    // 4. Return the checkout URL provided by the API
    const finalUrl =
      sessionData.url || sessionData.checkoutUrl || sessionData.paymentUrl;
    console.log("✅ SESSION CREATED:", finalUrl);

    return new Response(JSON.stringify({ url: finalUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ FUNCTION CRITICAL ERROR:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
