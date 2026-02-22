// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORE_ID = "store_913b2c5a8ee5";
const TAGADA_BASE_URL = "https://app.tagadapay.com";
const SITE_URL = "https://melbournepeptides.com.au";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CartItem {
  id?: string;
  variantId?: string;
  quantity: number;
}

interface VariantRecord {
  id: string;
  tagada_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { customer, cart, totals } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const variantIds = cart.map((i: CartItem) => i.variantId || i.id);
    const { data: variants } = await supabaseClient
      .from("variants")
      .select("id, tagada_id")
      .in("id", variantIds);

    const idMap = new Map<string, string>();
    if (variants) {
      variants.forEach((v: VariantRecord) => idMap.set(v.id, v.tagada_id));
    }

    // 1. Create Order in Database
    const cleanTotal = parseFloat(totals.total.toFixed(2));

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
        status: "pending_payment",
        total_amount: cleanTotal,
        shipping_cost: totals.shipping || 0,
        shipping_method: totals.shippingMethod || "standard",
        discount_code: totals.discountUsed || null,
        items: cart,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw new Error("DB Error: " + orderError.message);

    const items = cart.map((item: CartItem) => ({
      variantId:
        idMap.get(item.variantId || item.id || "") || "MISSING_TAGADA_ID",
      quantity: item.quantity,
    }));

    // 2. Build Tagada checkout URL
    const params = new URLSearchParams();
    params.set("storeId", STORE_ID);
    params.set("currency", "AUD");

    // Pass Supabase order ID so webhook can match it
    params.set("cartToken", order.id);
    params.set("ref", order.id);

    // ✅ returnUrl is the correct param per Tagada docs
    params.set("returnUrl", `${SITE_URL}/success?order_id=${order.id}`);

    // 👤 Customer Details (pre-fill)
    if (customer?.email) params.set("customerEmail", customer.email);
    if (customer?.phone) params.set("customerPhone", customer.phone);
    if (customer?.name) {
      const parts = customer.name.trim().split(" ");
      params.set("customerFirstName", parts[0] || "Customer");
      params.set("customerLastName", parts.slice(1).join(" ") || "Customer");
    }

    // 🛒 Cart Items
    params.set("items", JSON.stringify(items));

    const checkoutUrl = `${TAGADA_BASE_URL}/api/public/v1/checkout/init?${params.toString()}`;
    console.log("✅ Checkout URL Generated:", checkoutUrl);

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ CRITICAL ERROR:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: corsHeaders,
    });
  }
});