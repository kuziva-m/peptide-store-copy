// deno-lint-ignore-file no-import-prefix no-explicit-any
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

    // ======================================================================
    // 4. SEND ADMIN NOTIFICATION EMAIL
    // ======================================================================
    try {
      // Fetch the newly paid order details
      const { data: fullOrder } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("id", supabaseOrderId)
        .single();

      if (fullOrder) {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

        // Safely parse items (handling the stringified JSON)
        let items = [];
        try {
          items =
            typeof fullOrder.items === "string"
              ? JSON.parse(fullOrder.items)
              : fullOrder.items || [];
        } catch (e) {
          console.error("Failed to parse items for email:", e);
        }

        // Build HTML for items
        const itemsHtml = items
          .map((item: any) => {
            let name = item.product_name_snapshot || item.name || "Product";
            let size =
              item.variant?.size_label ||
              (typeof item.variant === "string" ? item.variant : "");
            let price = item.price_at_purchase || item.price || 0;
            return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0;">${name} ${size ? `<b>(${size})</b>` : ""}</td>
              <td style="padding: 10px 0; text-align: center;">x${item.quantity}</td>
              <td style="padding: 10px 0; text-align: right;">$${(price * item.quantity).toFixed(2)}</td>
            </tr>
          `;
          })
          .join("");

        // Build HTML for address
        const address = fullOrder.shipping_address || {};
        const addressHtml = address.line1
          ? `
          <p style="margin: 0; line-height: 1.5;">
            ${fullOrder.customer_name}<br>
            ${address.line1}<br>
            ${address.city}, ${address.state} ${address.postal_code}<br>
            ${address.country}<br>
            <strong>Phone:</strong> ${address.phone || "N/A"}<br>
            <strong>Email:</strong> ${fullOrder.customer_email}
          </p>
        `
          : `<p>No shipping address provided.</p>`;

        // Send Email via Resend
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Melbourne Peptides <info@melbournepeptides.com.au>",
            to: ["info@melbournepeptides.com.au"], // Sending TO the admin
            subject: `🚨 New Order Received! #${fullOrder.id.slice(0, 8)}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #16a34a; margin-top: 0;">🎉 Payment Successful!</h2>
                <p style="font-size: 16px; color: #334155;">You just received a new paid order for <strong>$${fullOrder.total_amount}</strong>.</p>
                
                <h3 style="background: #f8fafc; padding: 10px; border-radius: 4px; margin-top: 20px;">Shipping Details</h3>
                ${addressHtml}

                <h3 style="background: #f8fafc; padding: 10px; border-radius: 4px; margin-top: 20px;">Order Summary</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <thead>
                    <tr style="border-bottom: 2px solid #cbd5e1; text-align: left;">
                      <th style="padding-bottom: 8px;">Item</th>
                      <th style="padding-bottom: 8px; text-align: center;">Qty</th>
                      <th style="padding-bottom: 8px; text-align: right;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #cbd5e1; text-align: right;">
                  <p><strong>Shipping:</strong> $${fullOrder.shipping_cost || "0.00"} (${fullOrder.shipping_method || "Standard"})</p>
                  ${fullOrder.discount_code ? `<p><strong>Discount Code Used:</strong> ${fullOrder.discount_code}</p>` : ""}
                  <p style="font-size: 18px;"><strong>Total Paid: $${fullOrder.total_amount}</strong></p>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                  <a href="https://melbournepeptides.com.au/admin" style="background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Admin Panel</a>
                </div>
              </div>
            `,
          }),
        });

        console.log("📧 Admin notification email sent successfully.");
      }
    } catch (emailError) {
      // We catch this so an email failure doesn't crash the whole webhook
      console.error("⚠️ Failed to send admin email notification:", emailError);
    }

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
