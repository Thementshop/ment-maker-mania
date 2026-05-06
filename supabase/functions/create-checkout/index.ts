import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isInCurrentMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { priceId, userId, customerEmail, returnUrl, environment } = await req.json();

    if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) return json({ error: "Invalid priceId" }, 400);
    if (environment !== "sandbox" && environment !== "live") return json({ error: "Invalid environment" }, 400);
    if (!returnUrl) return json({ error: "Missing returnUrl" }, 400);

    const env: StripeEnv = environment;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Mint Boost: enforce one purchase per calendar month BEFORE checkout
    if (priceId === "mint_boost" && userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("mint_boost_last_purchased_at")
        .eq("id", userId)
        .maybeSingle();
      if (isInCurrentMonth(profile?.mint_boost_last_purchased_at as string | null)) {
        return json({ error: "mint_boost_already_purchased_this_month" }, 409);
      }
    }

    const stripe = createStripeClient(env);
    const prices = await stripe.prices.list({ lookup_keys: [priceId], limit: 1 });
    if (!prices.data.length) return json({ error: "Price not found" }, 404);
    const stripePrice = prices.data[0];

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      automatic_tax: { enabled: true },
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: {
        ...(userId && { userId }),
        priceId,
      },
    });

    return json({ clientSecret: session.client_secret });
  } catch (e) {
    console.error("create-checkout error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
