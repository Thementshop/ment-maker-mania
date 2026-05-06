import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

async function fulfill(session: any, env: StripeEnv) {
  const sb = getSupabase();
  const userId: string | undefined = session?.metadata?.userId;
  let priceId: string | undefined = session?.metadata?.priceId;

  // Fallback: pull priceId from line items via lookup_key
  if (!priceId) {
    try {
      const stripe = createStripeClient(env);
      const items = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price"] });
      const lookup = (items.data[0]?.price as any)?.lookup_key as string | undefined;
      if (lookup) priceId = lookup;
    } catch (e) {
      console.error("listLineItems failed", e);
    }
  }

  if (!userId || !priceId) {
    console.error("Missing userId or priceId on session", session.id, { userId, priceId });
    return;
  }

  // Pause Token packs
  const packMap: Record<string, number> = {
    pause_tokens_20: 20,
    pause_tokens_50: 50,
    pause_tokens_100: 100,
  };

  if (packMap[priceId]) {
    const add = packMap[priceId];
    const { data: prof } = await sb.from("profiles").select("pause_tokens").eq("id", userId).maybeSingle();
    const { data: gs } = await sb.from("user_game_state").select("pause_tokens").eq("user_id", userId).maybeSingle();
    await sb.from("profiles").update({ pause_tokens: ((prof?.pause_tokens as number) ?? 0) + add }).eq("id", userId);
    await sb.from("user_game_state").update({ pause_tokens: ((gs?.pause_tokens as number) ?? 0) + add }).eq("user_id", userId);
    return;
  }

  if (priceId === "pause_tokens_unlimited_year") {
    const { data: prof } = await sb
      .from("profiles")
      .select("pause_tokens_unlimited_expires_at")
      .eq("id", userId)
      .maybeSingle();
    const now = Date.now();
    const current = prof?.pause_tokens_unlimited_expires_at
      ? new Date(prof.pause_tokens_unlimited_expires_at as string).getTime()
      : 0;
    const base = current > now ? current : now;
    const newExpiry = new Date(base + 365 * 24 * 60 * 60 * 1000).toISOString();
    await sb
      .from("profiles")
      .update({ pause_tokens_unlimited: true, pause_tokens_unlimited_expires_at: newExpiry })
      .eq("id", userId);
    return;
  }

  if (priceId === "mint_boost") {
    const { data: gs } = await sb.from("user_game_state").select("jar_count").eq("user_id", userId).maybeSingle();
    await sb
      .from("user_game_state")
      .update({ jar_count: ((gs?.jar_count as number) ?? 0) + 25 })
      .eq("user_id", userId);
    await sb.from("profiles").update({ mint_boost_last_purchased_at: new Date().toISOString() }).eq("id", userId);
    return;
  }

  console.warn("Unknown priceId in webhook:", priceId);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  try {
    const event = await verifyWebhook(req, env);

    // Idempotency
    const sb = getSupabase();
    const { error: dupeErr } = await sb.from("payment_events").insert({
      event_id: event.id,
      event_type: event.type,
      raw: event as any,
    });
    if (dupeErr && (dupeErr as any).code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed" || event.type === "transaction.completed") {
      const session = event.data.object;
      // Only fulfill paid one-time sessions
      if (!session.payment_status || session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        await fulfill(session, env);
        const userId = session?.metadata?.userId;
        const priceId = session?.metadata?.priceId;
        if (userId || priceId) {
          await sb
            .from("payment_events")
            .update({ user_id: userId ?? null, price_id: priceId ?? null, amount_cents: session.amount_total ?? null })
            .eq("event_id", event.id);
        }
      }
    } else {
      console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
