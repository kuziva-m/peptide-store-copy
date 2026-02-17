// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CONFIGURATION ---
const STORE_ID = "store_913b2c5a8ee5";
const TAGADA_BASE_URL = "https://app.tagadapay.com/api/public/v1/checkout/init";

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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Fetch Tagada IDs from Database (if you want to use the IDs you've synced)
    const productIds = cart.map((i: any) => i.id);
    const { data: products } = await supabaseClient
      .from("products")
      .select("id, tagada_id")
      .in("id", productIds);

    const idMap = new Map();
    if (products) {
      products.forEach((p: any) => idMap.set(p.id, p.tagada_id));
    }

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
        total_amount: totals.total,
        shipping_cost: totals.shipping,
        shipping_method: totals.shippingMethod,
        discount_code: totals.discountUsed,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw new Error("Database Error: " + orderError.message);

    // 3. CONSTRUCT TAGADA REDIRECT URL (GET Request logic integrated here)
    const params = new URLSearchParams();

    // Required Params from Tagada Docs
    params.set("storeId", STORE_ID);
    params.set("currency", "AUD");

    // Customer Prefill
    params.set("customerEmail", customer.email);
    params.set("customerPhone", customer.phone);

    // Split name for prefill
    const nameParts = customer.name.trim().split(" ");
    params.set("customerFirstName", nameParts[0]);
    params.set("customerLastName", nameParts.slice(1).join(" ") || "Customer");

    /**
     * NOTE: We are mapping your live cart items.
     * To test specifically with the product ID you provided (product_48dbbd586dbe),
     * make sure that ID is synced in your Supabase 'products' table in the 'tagada_id' column.
     */
    const checkoutItems = cart.map((item: any) => {
      const tagadaId = idMap.get(item.id);
      return {
        // Fallback to the ID you provided if the database isn't synced yet
        variantId: tagadaId || "product_48dbbd586dbe",
        quantity: item.quantity,
      };
    });

    params.set("items", JSON.stringify(checkoutItems));

    // Custom Params for Tracking (This 'ref' must match your webhook logic)
    params.set("ref", order.id);

    // Build the Final URL using the init endpoint
    const finalUrl = `${TAGADA_BASE_URL}?${params.toString()}`;

    console.log("Redirecting to:", finalUrl);

    return new Response(JSON.stringify({ url: finalUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Function Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
