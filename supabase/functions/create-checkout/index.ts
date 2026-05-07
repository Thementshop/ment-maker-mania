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

async function getAuthenticatedUserId(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user.id;
}

function isPreviewBypassAllowed(returnUrl: string): boolean {
  try {
    const origin = new URL(returnUrl).origin;
    return origin.includes("id-preview--") || origin.includes("localhost");
  } catch {
    return false;
  }
}

async function applySandboxBypass(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  priceId: string,
) {
  const nowIso = new Date().toISOString();

  if (priceId === "mint_boost") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("mint_boost_last_purchased_at")
      .eq("id", userId)
      .maybeSingle();

    if (isInCurrentMonth(profile?.mint_boost_last_purchased_at as string | null)) {
      return { ok: false as const, status: 409, error: "mint_boost_already_purchased_this_month" };
    }

    const { data: gs } = await supabase
      .from("user_game_state")
      .select("jar_count")
      .eq("user_id", userId)
      .maybeSingle();

    const nextJarCount = ((gs?.jar_count as number | null) ?? 25) + 25;

    const [{ error: gameStateError }, { error: profileError }] = await Promise.all([
      supabase.from("user_game_state").update({ jar_count: nextJarCount }).eq("user_id", userId),
      supabase.from("profiles").update({ mint_boost_last_purchased_at: nowIso }).eq("id", userId),
    ]);

    if (gameStateError || profileError) {
      throw gameStateError ?? profileError;
    }

    return { ok: true as const, payload: { bypassApplied: true, granted: "mint_boost", quantity: 25 } };
  }

  const packMap: Record<string, number> = {
    pause_tokens_20: 20,
    pause_tokens_50: 50,
    pause_tokens_100: 100,
  };

  if (packMap[priceId]) {
    const add = packMap[priceId];
    const [{ data: prof }, { data: gs }] = await Promise.all([
      supabase.from("profiles").select("pause_tokens").eq("id", userId).maybeSingle(),
      supabase.from("user_game_state").select("pause_tokens").eq("user_id", userId).maybeSingle(),
    ]);

    const [{ error: profileError }, { error: gameStateError }] = await Promise.all([
      supabase
        .from("profiles")
        .update({ pause_tokens: (((prof?.pause_tokens as number | null) ?? 0) + add) })
        .eq("id", userId),
      supabase
        .from("user_game_state")
        .update({ pause_tokens: (((gs?.pause_tokens as number | null) ?? 0) + add) })
        .eq("user_id", userId),
    ]);

    if (profileError || gameStateError) {
      throw profileError ?? gameStateError;
    }

    return { ok: true as const, payload: { bypassApplied: true, granted: "pause_tokens", quantity: add } };
  }

  if (priceId === "pause_tokens_unlimited_year") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pause_tokens_unlimited_expires_at")
      .eq("id", userId)
      .maybeSingle();

    const currentExpiryMs = profile?.pause_tokens_unlimited_expires_at
      ? new Date(profile.pause_tokens_unlimited_expires_at as string).getTime()
      : 0;
    const baseMs = currentExpiryMs > Date.now() ? currentExpiryMs : Date.now();
    const nextExpiry = new Date(baseMs + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("profiles")
      .update({ pause_tokens_unlimited: true, pause_tokens_unlimited_expires_at: nextExpiry })
      .eq("id", userId);

    if (error) throw error;

    return { ok: true as const, payload: { bypassApplied: true, granted: "pause_tokens_unlimited_year", quantity: 365 } };
  }

  return { ok: false as const, status: 400, error: "unsupported_price_for_bypass" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { priceId, userId, customerEmail, returnUrl, environment, allowSandboxBypass } = await req.json();

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
    const account = await stripe.accounts.retrieve();

    if ("charges_enabled" in account && !account.charges_enabled) {
      if (env === "sandbox" && allowSandboxBypass === true && isPreviewBypassAllowed(returnUrl)) {
        const authenticatedUserId = await getAuthenticatedUserId(req, supabase);
        if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
          return json({ error: "Unauthorized" }, 401);
        }

        const bypassResult = await applySandboxBypass(supabase, authenticatedUserId, priceId);
        if (!bypassResult.ok) {
          return json({ error: bypassResult.error }, bypassResult.status);
        }

        return json(bypassResult.payload);
      }

      return json(
        {
          error: env === "sandbox" ? "sandbox_account_not_ready" : "live_account_not_ready",
          detailsSubmitted: account.details_submitted ?? false,
        },
        409,
      );
    }

    const prices = await stripe.prices.list({ lookup_keys: [priceId], limit: 1 });
    if (!prices.data.length) return json({ error: "Price not found" }, 404);
    const stripePrice = prices.data[0];

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      
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
