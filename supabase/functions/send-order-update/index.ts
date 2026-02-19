// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOGO_URL = "https://melbournepeptides.com.au/logo.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  name: string;
  quantity: number;
  size?: string;
  variant?: any;
  productName?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log("Received payload:", JSON.stringify(payload)); // DEBUG LOG

    const {
      email,
      name,
      orderId,
      trackingNumber,
      items,
      address,
      status,
      message,
    } = payload;

    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
    if (!email) throw new Error("Missing customer email");

    // 1. Content Logic
    let title = "Order Update";
    let subject = `Update: Order #${orderId?.slice(0, 8) || "Unknown"}`;
    let bodyText = `Your order status has been updated to: ${status}`;

    if (status === "custom") {
      title = "Update Regarding Your Order";
      subject = `Message: Order #${orderId?.slice(0, 8)}`;
      bodyText = message
        ? message.replace(/\n/g, "<br>")
        : "Please check your order details.";
    } else if (status === "label_created") {
      title = "Shipping Label Created";
      subject = `Shipping Update: Order #${orderId?.slice(0, 8)}`;
      bodyText =
        "Your shipping label has been created. Your package is being prepared and will be dispatched shortly.";
    } else if (status === "shipped") {
      title = "Order Dispatched";
      subject = `On The Way: Order #${orderId?.slice(0, 8)}`;
      bodyText = "Great news! Your order has been packed and dispatched.";
    } else if (status === "delivered") {
      title = "Order Delivered";
      subject = `Delivered: Order #${orderId?.slice(0, 8)}`;
      bodyText =
        "Your package has been delivered. We hope you enjoy your products.";
    }

    // 2. Tracking HTML
    const showTracking =
      trackingNumber && trackingNumber !== "N/A" && trackingNumber.length > 3;
    const trackingHtml = showTracking
      ? `
      <div style="margin: 30px 0; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
        <p style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px;">Tracking Number</p>
        <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 15px 0; letter-spacing: 1px;">${trackingNumber}</p>
        <a href="https://auspost.com.au/mypost/track/#/details/${trackingNumber}" style="background: #0f172a; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 14px; font-weight: 600;">Track Package</a>
      </div>
    `
      : "";

    // 3. Items HTML (WITH THE FIX)
    const itemsList = Array.isArray(items)
      ? items
          .map((item: any) => {
            let displayName = item.name || "Product";

            // 🛡️ SAFETY FILTER: If the name is ridiculously long, it's accidentally the description!
            // Let's fall back to a cleaner name from the variant or short name if we have it.
            if (displayName.length > 50) {
              if (item.productName) displayName = item.productName;
              else if (typeof item.variant === "string")
                displayName = item.variant.split(" - ")[0] || item.variant;
              else if (item.size)
                displayName = item.size.split(" - ")[0]; // Try to extract from size
              else displayName = "Peptide"; // Final fallback
            }

            // Get a clean size label
            let sizeLabel = item.size || "";
            if (!sizeLabel && typeof item.variant === "string")
              sizeLabel = item.variant;
            if (!sizeLabel && item.variant?.size_label)
              sizeLabel = item.variant.size_label;

            return `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #334155;">
                  <strong>${displayName}</strong>
                  ${sizeLabel && sizeLabel !== displayName ? `<br><span style="color: #64748b; font-size: 13px;">${sizeLabel}</span>` : ""}
                </td>
                <td style="padding: 10px 0; text-align: right; font-weight: 600;">x${item.quantity || 1}</td>
              </tr>
            `;
          })
          .join("")
      : "";

    // 4. Send Email
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Melbourne Peptides <info@melbournepeptides.com.au>", // Updated Sender
        to: [email],
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding: 40px 0;">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff; border-radius:8px; overflow:hidden; max-width:100%;">
                    <tr>
                      <td align="center" style="padding:30px; border-bottom:1px solid #f1f5f9;">
                        <img src="${LOGO_URL}" alt="Melbourne Peptides" height="40" />
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <h1 style="color:#0f172a; margin-top:0; font-size:24px; text-align:center;">${title}</h1>
                        <p style="color:#475569; font-size:16px; line-height:1.6;">Hi ${name || "there"},</p>
                        <p style="color:#475569; font-size:16px; line-height:1.6;">${bodyText}</p>
                        
                        ${trackingHtml}

                        <h3 style="color:#0f172a; font-size:14px; text-transform:uppercase; margin-top:30px;">Order Summary</h3>
                        <table width="100%" style="border-collapse:collapse;">${itemsList}</table>
                        
                        ${
                          address
                            ? `
                          <div style="margin-top:30px; padding-top:20px; border-top:1px solid #f1f5f9;">
                            <p style="font-size:14px; color:#64748b; margin:0;"><strong>Shipping to:</strong><br/>
                            ${address.line1}<br/>${address.city}, ${address.state} ${address.postal_code}</p>
                          </div>
                        `
                            : ""
                        }
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#f8fafc; padding:20px; text-align:center; color:#94a3b8; font-size:12px;">
                        Melbourne Peptides | info@melbournepeptides.com.au
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("Function Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
