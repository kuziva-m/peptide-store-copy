// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORE_ID = "store_913b2c5a8ee5";
const TAGADA_API_URL =
  "https://app.tagadapay.com/api/public/v1/checkout/sessions";
const SITE_URL = "https://melbournepeptides.com.au";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- TYPESCRIPT INTERFACES TO FIX LINTER ERRORS ---
interface CartItem {
  id?: string;
  variantId?: string;
  quantity: number;
}

interface VariantRecord {
  id: string;
  tagada_id: string;
}

interface TagadaSessionPayload {
  storeId: string;
  currency: string;
  amount: number;
  referenceId: string;
  cartToken: string;
  items: Array<{ variantId: string; quantity: number }>;
  successUrl: string;
  cancelUrl: string;
  metadata: { ref: string };
  customer?: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}
// ---------------------------------------------------

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
        total_amount: totals.total,
        shipping_cost: totals.shipping || 0,
        shipping_method: totals.shippingMethod || "standard",
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

    const TAGADA_SECRET = Deno.env.get("TAGADA_SECRET");
    const cleanTotal = parseFloat(totals.total.toFixed(2));

    // Fix: Explicitly declare the type here so TypeScript knows .customer is allowed
    const sessionPayload: TagadaSessionPayload = {
      storeId: STORE_ID,
      currency: "AUD",
      amount: Math.round(cleanTotal * 100),
      referenceId: order.id,
      cartToken: order.id, // Fallback injection
      items: items,
      successUrl: `${SITE_URL}/success?order_id=${order.id}`,
      cancelUrl: `${SITE_URL}/shop`,
      metadata: { ref: order.id },
    };

    if (customer?.email) {
      const parts = (customer.name || "Customer").trim().split(" ");
      sessionPayload.customer = {
        email: customer.email,
        firstName: parts[0],
        lastName: parts.slice(1).join(" ") || "",
        phone: customer.phone || "",
      };
    }

    const response = await fetch(TAGADA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAGADA_SECRET}`,
      },
      body: JSON.stringify(sessionPayload),
    });

    const sessionData = await response.json();
    if (!response.ok)
      throw new Error(sessionData.message || "Tagada API Error");

    // 2. IMPORTANT FIX: Save Tagada's ID back to our database instantly!
    const tagadaId =
      sessionData.orderId || sessionData.paymentId || sessionData.id;
    if (tagadaId) {
      await supabaseClient
        .from("orders")
        .update({ stripe_session_id: tagadaId })
        .eq("id", order.id);
      console.log(`🔗 Linked DB Order ${order.id} -> Tagada ID ${tagadaId}`);
    }

    const checkoutUrl =
      sessionData.url || sessionData.checkoutUrl || sessionData.paymentUrl;

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
