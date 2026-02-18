// deno-lint-ignore-file no-import-prefix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STORE_ID = "store_913b2c5a8ee5";
const TAGADA_API_URL = "https://app.tagadapay.com/api/v1/products";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const TAGADA_SECRET = Deno.env.get("TAGADA_SECRET");
    if (!TAGADA_SECRET) throw new Error("Missing TAGADA_SECRET env var");

    // 1. Fetch Products AND their Variants
    const { data: products, error } = await supabaseClient
      .from("products")
      .select(
        `id, name, description, variants (id, size_label, price, tagada_id)`,
      );

    if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
    if (!products) throw new Error("No products returned from Supabase");

    const logs = [];

    // 2. Loop through each product and sync to Tagada
    for (const product of products) {
      if (!product.variants || product.variants.length === 0) {
        logs.push(`⚠️ Skipped ${product.name} (no variants)`);
        continue;
      }

      // Skip if all variants already have tagada_id
      const allSynced = product.variants.every((v: any) => v.tagada_id);
      if (allSynced) {
        logs.push(`⏭️ Skipped ${product.name} (already synced)`);
        continue;
      }

      const payload = {
        storeId: STORE_ID,
        name: product.name,
        description: product.description || "",
        variants: product.variants.map((v: any) => ({
          name: `${product.name} - ${v.size_label}`,
          price: Math.round(parseFloat(v.price) * 100),
          currency: "AUD",
          sku: `supa_${v.id}`,
        })),
      };

      // Safe fetch from Tagada
      const response = await fetch(TAGADA_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TAGADA_SECRET}`,
        },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      logs.push(
        `📡 Tagada response for ${product.name} [${response.status}]: ${rawText.slice(0, 300)}`,
      );

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        logs.push(`❌ Non-JSON from Tagada for ${product.name}`);
        continue;
      }

      if (!response.ok) {
        logs.push(
          `❌ Failed to create ${product.name}: ${JSON.stringify(data)}`,
        );
        continue;
      }

      // 3. Save tagada variant IDs back to Supabase
      const tagadaVariants = data.variants ?? data.data?.variants ?? [];
      for (const tagadaVariant of tagadaVariants) {
        const supabaseVariantId = tagadaVariant.sku?.split("_")[1];
        if (supabaseVariantId) {
          await supabaseClient
            .from("variants")
            .update({ tagada_id: tagadaVariant.id })
            .eq("id", supabaseVariantId);
          logs.push(
            `✅ Synced: ${product.name} (${tagadaVariant.name}) → ${tagadaVariant.id}`,
          );
        }
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ success: true, logs }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
