// Pulls pending emails from public.email_queue and forwards them to send-email.
// Triggered every minute by pg_cron. No auth required (verify_jwt = false).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logError } from '../_shared/error-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 25;
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Atomically claim a batch using a CTE-style update.
    // (Postgrest can't do FOR UPDATE SKIP LOCKED directly, so we use an RPC-less
    //  approach: select candidate IDs, then UPDATE only the rows whose status is
    //  still 'pending'. The optimistic check on `status` makes concurrent workers safe.)
    const nowIso = new Date().toISOString();
    const { data: candidates, error: pickErr } = await admin
      .from('email_queue')
      .select('id')
      .eq('status', 'pending')
      .lte('next_attempt_at', nowIso)
      .order('next_attempt_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (pickErr) throw pickErr;
    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ids = candidates.map((r) => r.id);

    // Mark as processing — only flips rows still in 'pending' (optimistic lock).
    const { data: claimed, error: claimErr } = await admin
      .from('email_queue')
      .update({ status: 'processing', locked_at: nowIso, locked_by: WORKER_ID })
      .in('id', ids)
      .eq('status', 'pending')
      .select('*');

    if (claimErr) throw claimErr;
    if (!claimed || claimed.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, note: 'all-stolen' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;
    let dlq = 0;

    for (const row of claimed) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            email_type: row.email_type,
            recipient_email: row.recipient_email,
            recipient_id: row.recipient_id,
            chain_id: row.chain_id,
            template_data: row.payload,
          }),
        });

        if (resp.ok) {
          await admin
            .from('email_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
            .eq('id', row.id);
          sent++;
        } else {
          const text = await resp.text().catch(() => '');
          throw new Error(`send-email returned ${resp.status}: ${text.slice(0, 500)}`);
        }
      } catch (err) {
        const errMsg = (err as Error).message ?? String(err);
        const newAttempts = (row.attempts ?? 0) + 1;
        const isDlq = newAttempts >= (row.max_attempts ?? 5);

        if (isDlq) {
          await admin
            .from('email_queue')
            .update({
              status: 'dlq',
              attempts: newAttempts,
              last_error: errMsg,
              locked_at: null,
              locked_by: null,
            })
            .eq('id', row.id);

          await logError({
            source: 'process-email-queue',
            errorType: 'queue_dlq',
            severity: 'critical',
            recipientEmail: row.recipient_email,
            chainId: row.chain_id,
            message: `Email permanently failed after ${newAttempts} attempts: ${errMsg}`,
            context: { email_type: row.email_type, queue_id: row.id, attempts: newAttempts },
          });
          dlq++;
        } else {
          // Exponential backoff: 30s, 60s, 120s, 240s, ...
          const backoffSec = 30 * Math.pow(2, newAttempts - 1);
          const nextAt = new Date(Date.now() + backoffSec * 1000).toISOString();
          await admin
            .from('email_queue')
            .update({
              status: 'pending',
              attempts: newAttempts,
              next_attempt_at: nextAt,
              last_error: errMsg,
              locked_at: null,
              locked_by: null,
            })
            .eq('id', row.id);

          await logError({
            source: 'process-email-queue',
            errorType: 'email_failed',
            severity: 'warn',
            recipientEmail: row.recipient_email,
            chainId: row.chain_id,
            message: `Send failed (attempt ${newAttempts}/${row.max_attempts}): ${errMsg}`,
            context: { email_type: row.email_type, queue_id: row.id },
          });
          failed++;
        }
      }
    }

    console.log(`[process-email-queue] ${sent} sent, ${failed} retrying, ${dlq} dlq, took ${Date.now() - startedAt}ms`);
    return new Response(
      JSON.stringify({ success: true, processed: claimed.length, sent, failed, dlq }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[process-email-queue] Fatal:', err);
    await logError({
      source: 'process-email-queue',
      errorType: 'worker_crash',
      severity: 'critical',
      message: (err as Error).message ?? String(err),
    });
    return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
