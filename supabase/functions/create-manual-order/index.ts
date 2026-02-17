import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "info@melbournepeptides.com.au";
const LOGO_URL = "https://melbournepeptides.com.au/logo.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Template Wrapper (Matches professional theme) ---
const renderEmailTemplate = (title: string, contentHtml: string) => `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td align="center" style="padding: 40px 20px; border-bottom: 1px solid #f1f5f9;">
              <img src="${LOGO_URL}" alt="Melbourne Peptides" height="50" />
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h1 style="font-size: 22px; color: #0f172a; text-align: center; margin-bottom: 24px;">${title}</h1>
              <div style="font-size: 16px; line-height: 1.6; color: #475569;">${contentHtml}</div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
              Melbourne Peptides | info@melbournepeptides.com.au
            </td>
          </tr>
        </table>
        <p style="margin-top: 24px; font-size: 11px; color: #cbd5e1; text-align: center;">Peptides. Not for human consumption.</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

interface OrderPayload {
  customer: {
    email: string;
    name: string;
    line1: string;
    city: string;
    state: string;
    postcode: string;
    phone: string;
  };
  cart: any[];
  totals: {
    total: number;
    shipping: number;
    shippingMethod: string;
    discountUsed?: string;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { customer, cart, totals } = (await req.json()) as OrderPayload;
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Save to Database
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
        discount_code: totals.discountUsed || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const shortOrderId = order.id.slice(0, 8).toUpperCase();

    // 2. Insert Order Items (Including variant details)
    const orderItems = cart.map((item) => ({
      order_id: order.id,
      quantity: item.quantity,
      price_at_purchase: item.price,
      product_name_snapshot: item.variant
        ? `${item.name} (${item.variant})`
        : item.name,
      variant_id: item.variantId || null,
    }));
    await supabaseClient.from("order_items").insert(orderItems);

    // 3. Build HTML Components for Emails
    const itemsHtml = cart
      .map(
        (item) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 0;"><strong>${item.name}</strong><br/><span style="color: #64748b; font-size: 13px;">${item.variant || "Standard"}</span></td>
        <td style="padding: 12px 0; text-align: right;">x${item.quantity}</td>
        <td style="padding: 12px 0; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `,
      )
      .join("");

    const addressBlock = `
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #64748b; text-transform: uppercase;">Shipping Address</p>
        <p style="margin: 8px 0 0 0; color: #334155;">
          ${customer.name}<br/>
          ${customer.line1}<br/>
          ${customer.city}, ${customer.state} ${customer.postcode}<br/>
          Phone: ${customer.phone}
        </p>
      </div>
    `;

    // --- UPDATED: PAYID INSTRUCTIONS BLOCK ---
    const bankDetailsBlock = `
      <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border: 1px solid #bfdbfe; margin: 24px 0;">
        <h3 style="margin-top: 0; color: #1e40af;">Payment Instructions</h3>
        <p style="margin: 0 0 16px 0; color: #1e3a8a;">Please complete your payment via PayID using the details below:</p>
        
        <p style="margin: 0; color: #1e3a8a; line-height: 1.6; font-size: 16px;">
          <strong>PayID Type:</strong> Email Address<br/>
          <strong>PayID Email:</strong> <span style="color: #3b82f6; font-weight: bold;">info@melbournepeptides.com.au</span><br/>
          <strong>Reference:</strong> <span style="color: #e11d48; font-weight: bold;">#${shortOrderId}</span>
        </p>
        
        <p style="margin: 16px 0 0 0; font-size: 14px; color: #e11d48; font-weight: 600;">
          *Important: You MUST use your Order Reference (#${shortOrderId}) as the payment description so we can match your payment.
        </p>
        <p style="margin: 12px 0 0 0; font-size: 14px; color: #1e3a8a;">
          Once paid, please reply to this email with a screenshot of your receipt to expedite shipping.
        </p>
      </div>
    `;

    if (RESEND_API_KEY) {
      // --- CUSTOMER EMAIL ---
      const customerBody = `
        <p>Hi ${customer.name},</p>
        <p>Thank you for your order! To complete your purchase and secure your items, please make your payment via PayID.</p>
        
        ${bankDetailsBlock}

        <table width="100%" style="border-collapse: collapse; margin: 24px 0;">
          ${itemsHtml}
          <tr style="border-top: 2px solid #e2e8f0;">
             <td colspan="2" style="padding: 12px 0; font-weight: bold; text-align: right;">Shipping (${totals.shippingMethod}):</td>
             <td style="padding: 12px 0; text-align: right; font-weight: bold;">$${totals.shipping.toFixed(2)}</td>
          </tr>
        </table>
        
        <div style="text-align: right; font-weight: 800; font-size: 20px; color: #0f172a; margin-top: 10px;">
          Total to Pay: $${totals.total.toFixed(2)}
        </div>

        ${addressBlock}
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Melbourne Peptides <info@melbournepeptides.com.au>",
          to: [customer.email],
          subject: `Payment Required: Order #${shortOrderId}`,
          html: renderEmailTemplate(
            "Order Received - Payment Required",
            customerBody,
          ),
        }),
      });

      // --- ADMIN EMAIL ---
      const adminBody = `
        <p style="color: #be123c; font-weight: bold;">ACTION REQUIRED: Manual payment collection pending.</p>
        <p>Customer has been emailed the PayID instructions. Please monitor the account for a payment of <strong>$${totals.total.toFixed(2)}</strong> with reference <strong>#${shortOrderId}</strong>.</p>
        <p><strong>Customer Email:</strong> <a href="mailto:${customer.email}">${customer.email}</a></p>
        
        <table width="100%" style="border-collapse: collapse; margin: 24px 0;">${itemsHtml}</table>
        ${addressBlock}
        
        <p><strong>Shipping Method:</strong> ${totals.shippingMethod}</p>
        <p><strong>Discount Code:</strong> ${totals.discountUsed || "None"}</p>
        <h3 style="text-align: right;">Total Value: $${totals.total.toFixed(2)}</h3>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://melbournepeptides.com.au/admin" style="background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Go to Admin Panel</a>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "System <info@melbournepeptides.com.au>",
          to: [ADMIN_EMAIL],
          subject: `PENDING PAYMENT: Order #${shortOrderId} - $${totals.total.toFixed(2)}`,
          html: renderEmailTemplate("New Manual Order", adminBody),
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, orderId: order.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
