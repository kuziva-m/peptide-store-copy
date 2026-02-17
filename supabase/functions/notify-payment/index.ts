import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = "info@melbournepeptides.com.au";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { orderId, customerName, amount, proofUrl } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Update Database Status & Save Proof URL
    await supabaseClient
      .from("orders")
      .update({
        notes: "PAYMENT PROOF SUBMITTED",
        status: "payment_reported",
        receipt_url: proofUrl, // Saving proof URL to receipt_url column (or create a new column 'payment_proof_url')
      })
      .eq("id", orderId);

    // 2. Send Email to Admin
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "System <info@melbournepeptides.com.au>",
          to: [ADMIN_EMAIL],
          subject: `💰 PROOF ATTACHED: Order #${orderId.slice(0, 8)}`,
          html: `
            <div style="font-family: sans-serif; border: 2px solid #10b981; padding: 20px; border-radius: 10px;">
              <h2 style="color: #10b981;">Payment Proof Submitted</h2>
              <p>Customer has uploaded a receipt.</p>
              
              <ul style="font-size: 16px;">
                <li><strong>Customer:</strong> ${customerName}</li>
                <li><strong>Order ID:</strong> #${orderId.slice(0, 8).toUpperCase()}</li>
                <li><strong>Amount:</strong> $${amount}</li>
              </ul>

              <div style="margin: 20px 0; text-align: center;">
                ${
                  proofUrl
                    ? `<a href="${proofUrl}" style="background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Payment Proof</a>`
                    : `<p style="color: red;">No proof file attached.</p>`
                }
              </div>
              
              <p style="font-weight: bold; color: #0f172a;">Action Required:</p>
              <ol>
                <li>Click the button above to view the screenshot.</li>
                <li>Check your Bank/PayID to confirm funds have arrived.</li>
                <li>If confirmed, go to Admin Panel and mark as <strong>Paid/Processing</strong>.</li>
              </ol>
              
              <p><a href="https://melbournepeptides.com.au/admin">Go to Admin Panel</a></p>
            </div>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
