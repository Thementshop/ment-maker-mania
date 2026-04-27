// Health check endpoint. GET returns JSON with current backend status.
// Use externally with UptimeRobot/BetterStack or by hand: curl <url>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckResult {
  ok: boolean;
  latency_ms?: number;
  detail?: string;
}

async function checkDb(admin: ReturnType<typeof createClient>): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const { error } = await admin.from('world_kindness_counter').select('count').limit(1).single();
    if (error) return { ok: false, latency_ms: Date.now() - t0, detail: error.message };
    return { ok: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, detail: (e as Error).message };
  }
}

async function checkResend(): Promise<CheckResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, detail: 'RESEND_API_KEY not configured' };
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    clearTimeout(to);
    return { ok: r.ok, latency_ms: Date.now() - t0, detail: r.ok ? undefined : `status ${r.status}` };
  } catch (e) {
    return { ok: false, latency_ms: Date.now() - t0, detail: (e as Error).message };
  }
}

async function checkQueue(admin: ReturnType<typeof createClient>) {
  try {
    const { count: pending } = await admin
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    const { count: dlq } = await admin
      .from('email_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'dlq');
    const { data: oldest } = await admin
      .from('email_queue')
      .select('created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const oldestAge = oldest ? Math.round((Date.now() - new Date(oldest.created_at).getTime()) / 1000) : 0;
    const ok = (dlq ?? 0) <= 10 && oldestAge <= 300;
    return { ok, pending: pending ?? 0, dlq: dlq ?? 0, oldest_pending_age_s: oldestAge };
  } catch (e) {
    return { ok: false, pending: -1, dlq: -1, oldest_pending_age_s: -1, detail: (e as Error).message };
  }
}

async function checkRecentErrors(admin: ReturnType<typeof createClient>) {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('error_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fiveMinAgo)
      .in('severity', ['error', 'critical']);
    const c = count ?? 0;
    return { ok: c <= 20, count_5m: c };
  } catch (e) {
    return { ok: false, count_5m: -1, detail: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const [database, email_provider, email_queue, recent_errors] = await Promise.all([
    checkDb(admin),
    checkResend(),
    checkQueue(admin),
    checkRecentErrors(admin),
  ]);

  const allOk = database.ok && email_provider.ok && email_queue.ok && recent_errors.ok;
  const anyDown = !database.ok || !email_provider.ok;
  const status = anyDown ? 'down' : allOk ? 'ok' : 'degraded';

  return new Response(
    JSON.stringify({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        email_provider,
        edge_runtime: { ok: true },
        email_queue,
        recent_errors,
      },
    }, null, 2),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
