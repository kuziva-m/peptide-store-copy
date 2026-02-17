// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORE_ID = "store_913b2c5a8ee5";
const TAGADA_BASE_URL = "https://app.tagadapay.com";

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
    console.log("📦 STARTING CHECKOUT SESSION:", {
      email: customer.email,
      total: totals.total,
    });

    // 1. Initialize Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 2. Fetch Tagada variant IDs from your DB
    const productIds = cart.map((i: any) => i.id);
    const { data: products } = await supabaseClient
      .from("products")
      .select("id, tagada_id")
      .in("id", productIds);

    const idMap = new Map();
    if (products) products.forEach((p: any) => idMap.set(p.id, p.tagada_id));

    // 3. Create Order in Database
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
        total_amount: totals.total,
        shipping_cost: totals.shipping,
        shipping_method: totals.shippingMethod,
        discount_code: totals.discountUsed,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw new Error("DB Error: " + orderError.message);
    console.log("📝 ORDER SAVED:", order.id);

    // 4. Build Tagada checkout URL using GET /checkout/init (no auth needed)
    // Items must be JSON-encoded as a query param
    const items = cart.map((item: any) => ({
      variantId: idMap.get(item.id),
      quantity: item.quantity,
    }));

    // Check all items have valid variant IDs
    const missingVariants = items.filter((i: any) => !i.variantId);
    if (missingVariants.length > 0) {
      throw new Error(
        `Missing tagada_id for ${missingVariants.length} product(s) in your DB`,
      );
    }

    const nameParts = customer.name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "Customer";

    const params = new URLSearchParams({
      storeId: STORE_ID,
      currency: "AUD",
      items: JSON.stringify(items),
      customerEmail: customer.email,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerPhone: customer.phone,
      // Pass order ID so your webhook can match it
      ref: order.id,
    });

    const checkoutUrl = `${TAGADA_BASE_URL}/api/public/v1/checkout/init?${params.toString()}`;

    console.log("✅ CHECKOUT URL BUILT:", checkoutUrl);

    // 5. Return the checkout URL to the frontend
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
