import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { checkComplimentContent } from '../_shared/contentFilter.ts';
import { buildSingleMentShortMessage } from '../_shared/notification-copy.ts';
import { isOptedOut } from '../_shared/opt-out.ts';
import { getAppBaseUrl } from '../_shared/app-url.ts';
import { checkAndRecordSend } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Normalize a phone number to E.164 (+ followed by 8–15 digits). US 10-digit
// numbers default to +1. Returns null if it can't produce a valid shape.
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  if (!cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 10) cleaned = '+1' + digits;
    else cleaned = '+' + digits;
  }
  if (!/^\+\d{8,15}$/.test(cleaned)) return null;
  return cleaned;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = authUser.id;
    const userEmail = authUser.email as string;

    // ─── Phone verification gate (primary anti-abuse gate) ───
    {
      const { data: profileRow } = await adminClient
        .from('profiles')
        .select('phone_verified')
        .eq('id', userId)
        .maybeSingle();
      if (profileRow?.phone_verified !== true) {
        return new Response(
          JSON.stringify({ status: 'phone_not_verified', error: 'phone_not_verified' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const body = await req.json();
    const {
      recipient_email,
      recipient_phone,
      delivery_method,
      compliment_text,
      compliment_category,
      recipients,       // array of { email, name?, phone? } for group sends
      group_id,         // uuid of a named saved group (optional)
    } = body;

    if (!compliment_text || !compliment_category) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── Content filter (authoritative security boundary) ───
    const contentCheck = checkComplimentContent(compliment_text);
    if (contentCheck.blocked) {
      try {
        await adminClient.from('content_block_log').insert({
          user_id: userId,
          blocked_text: compliment_text,
          trigger_term: contentCheck.match ?? '',
          match_type: contentCheck.reason ?? 'unknown',
        });
      } catch (logErr) {
        console.error('[SEND-A-MENT] block-log insert failed:', logErr);
      }
      return new Response(JSON.stringify({ error: 'blocked' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const baseAppUrl = getAppBaseUrl();

    // Is this a group send (multiple recipients in one action)?
    const isGroup = Array.isArray(recipients) && recipients.length > 0;

    // ─── Sender ban check (applies to every send path) ───
    let senderBanned = false;
    try {
      const { data: bannedRow } = await adminClient
        .from('profiles')
        .select('is_banned')
        .eq('id', userId)
        .maybeSingle();
      senderBanned = bannedRow?.is_banned === true;
    } catch (banErr) {
      console.error('[SEND-A-MENT] ban check failed:', banErr);
    }

    // Sender display name (used for email payloads)
    const { data: senderProfile } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    const senderName = senderProfile?.display_name || userEmail?.split('@')[0] || 'Someone';

    // Shared helper: award exactly ONE mint to the sender + bump legacy counters.
    // Called once per send ACTION (single or group) regardless of recipient count.
    async function awardSenderMintAndCounters(): Promise<number> {
      const { error: mintTransactionError } = await adminClient
        .from('mint_transactions')
        .insert({ user_id: userId, amount: 1, reason: 'send' });
      if (mintTransactionError) console.error('[SEND-A-MENT] Mint transaction error:', mintTransactionError);

      const { data: gameState } = await adminClient
        .from('user_game_state')
        .select('jar_count, total_sent')
        .eq('user_id', userId)
        .single();
      const newJarCount = (gameState?.jar_count ?? 1) + 1;
      const newTotalSent = (gameState?.total_sent ?? 0) + 1;
      await adminClient
        .from('user_game_state')
        .update({ jar_count: newJarCount, total_sent: newTotalSent })
        .eq('user_id', userId);
      await adminClient.rpc('increment_world_counter');
      return newJarCount;
    }

    // ═══════════════════════════════════════════════════════════════════
    // GROUP SEND
    // ═══════════════════════════════════════════════════════════════════
    if (isGroup) {
      // Build a clean, de-duplicated recipient list (email channel only).
      const seen = new Set<string>();
      const cleanRecipients: { email: string; name?: string }[] = [];
      for (const r of recipients) {
        const email = String(r?.email ?? '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) continue;
        if (email === userEmail?.toLowerCase()) continue; // can't send to yourself
        if (seen.has(email)) continue;
        seen.add(email);
        cleanRecipients.push({ email, name: r?.name ? String(r.name) : undefined });
      }

      if (cleanRecipients.length === 0) {
        return new Response(JSON.stringify({ error: 'No valid recipients in that group' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ─── Rate-limit gate (records the action when allowed) ───
      const rl = await checkAndRecordSend(adminClient, userId, 'group', cleanRecipients.length, 'email');
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({ error: 'rate_limited', error_code: rl.errorCode, message: rl.message }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Shared id linking every Ment from this one group send.
      const groupSendId = crypto.randomUUID();
      const namedGroupId = typeof group_id === 'string' && group_id.length > 0 ? group_id : null;

      // Deliver to each recipient individually (each gets their own row + email).
      if (!senderBanned) {
        for (const r of cleanRecipients) {
          try {
            // Per-recipient blocked-sender / do-not-contact enforcement.
            let discard = false;
            try {
              const { data: blocked } = await adminClient.rpc('is_blocked_by_email', {
                _sender: userId, _recipient_email: r.email,
              });
              if (blocked === true) discard = true;
            } catch (e) { console.error('[SEND-A-MENT] group block check failed:', e); }
            if (!discard) {
              try { if (await isOptedOut(adminClient, r.email)) discard = true; }
              catch (e) { console.error('[SEND-A-MENT] group opt-out check failed:', e); }
            }
            if (discard) continue;

            const { data: inserted, error: insErr } = await adminClient
              .from('sent_ments')
              .insert({
                sender_id: userId,
                recipient_email: r.email,
                recipient_phone: null,
                compliment_text,
                category: compliment_category,
                recipient_type: 'email',
                group_id: namedGroupId,
                group_send_id: groupSendId,
              })
              .select('id')
              .single();
            if (insErr) { console.error('[SEND-A-MENT] group insert failed:', insErr); continue; }

            const revealUrl = `${baseAppUrl}/ment/${inserted.id}?auto=1`;
            await adminClient.from('email_queue').insert({
              email_type: 'ment_received',
              recipient_email: r.email,
              recipient_id: null,
              chain_id: null,
              payload: {
                recipient_name: r.name || r.email.split('@')[0],
                chain_name: '',
                sender_name: senderName,
                compliment_text,
                compliment_category,
                chain_url: baseAppUrl,
                app_url: baseAppUrl,
                ment_id: inserted.id,
                reveal_url: revealUrl,
              },
            });

            // Recipient earns a mint if they already have an account.
            adminClient.rpc('award_mint_to_email', { _email: r.email })
              .then(({ error }: { error: unknown }) => {
                if (error) console.warn('[SEND-A-MENT] group recipient mint award failed:', error);
              });
          } catch (loopErr) {
            console.error('[SEND-A-MENT] group recipient loop error:', loopErr);
          }
        }
      }

      // Sender earns exactly ONE mint for the whole group send.
      const newJarCount = await awardSenderMintAndCounters();

      return new Response(
        JSON.stringify({ success: true, mint_earned: true, new_jar_count: newJarCount, recipient_count: cleanRecipients.length }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SINGLE SEND (email or text) — original behaviour + rate limiting
    // ═══════════════════════════════════════════════════════════════════
    const method: 'email' | 'text' = delivery_method === 'text' ? 'text' : 'email';

    let normalizedPhone: string | null = null;
    if (method === 'text') {
      normalizedPhone = normalizePhone(recipient_phone ?? '');
      if (!normalizedPhone) {
        return new Response(JSON.stringify({ error: "That doesn't look like a valid phone number" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      if (!recipient_email) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (recipient_email.toLowerCase() === userEmail?.toLowerCase()) {
        return new Response(JSON.stringify({ error: "You can't send a ment to yourself" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ─── Rate-limit gate ───
    const rlSingle = await checkAndRecordSend(
      adminClient, userId, 'single', 1, method === 'text' ? 'sms' : 'email',
    );
    if (!rlSingle.allowed) {
      return new Response(
        JSON.stringify({ error: 'rate_limited', error_code: rlSingle.errorCode, message: rlSingle.message }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Silent-discard enforcement (blocked / opted-out / banned) ───
    let silentlyDiscarded = senderBanned;
    if (!silentlyDiscarded && method === 'email') {
      try {
        const { data: blocked } = await adminClient.rpc('is_blocked_by_email', {
          _sender: userId, _recipient_email: recipient_email,
        });
        if (blocked === true) silentlyDiscarded = true;
      } catch (blockErr) {
        console.error('[SEND-A-MENT] block check failed:', blockErr);
      }
      try {
        if (await isOptedOut(adminClient, recipient_email)) silentlyDiscarded = true;
      } catch (optErr) {
        console.error('[SEND-A-MENT] opt-out check failed:', optErr);
      }
    }

    // Insert sent ment (skipped entirely when silently discarded)
    let insertedMent: { id: string } | null = null;
    if (!silentlyDiscarded) {
      const { data, error: insertError } = await adminClient
        .from('sent_ments')
        .insert({
          sender_id: userId,
          recipient_email: method === 'email' ? recipient_email : null,
          recipient_phone: method === 'text' ? normalizedPhone : null,
          compliment_text,
          category: compliment_category,
          recipient_type: method === 'text' ? 'phone' : 'email',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[SEND-A-MENT] Insert error:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to save ment' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      insertedMent = data;
    }

    // Sender earns exactly one mint.
    const newJarCount = await awardSenderMintAndCounters();

    // Award +1 mint to recipient (email accounts only). Fire-and-forget.
    if (!silentlyDiscarded && method === 'email') {
      adminClient.rpc('award_mint_to_email', { _email: recipient_email })
        .then(({ error }: { error: unknown }) => {
          if (error) console.warn('[SEND-A-MENT] Recipient mint award failed:', error);
        });
    }

    // Auto-save contact (legacy saved_contacts is keyed by email; email sends only).
    if (method === 'email') {
      const contactName = recipient_email.split('@')[0];
      const { data: existingContact } = await adminClient
        .from('saved_contacts')
        .select('id, times_sent')
        .eq('user_id', userId)
        .eq('contact_email', recipient_email.toLowerCase())
        .maybeSingle();

      if (existingContact) {
        await adminClient
          .from('saved_contacts')
          .update({ times_sent: existingContact.times_sent + 1, last_sent_at: new Date().toISOString() })
          .eq('id', existingContact.id);
      } else {
        await adminClient
          .from('saved_contacts')
          .insert({ user_id: userId, contact_email: recipient_email.toLowerCase(), contact_name: contactName });
      }
    }

    const revealUrl = `${baseAppUrl}/ment/${insertedMent?.id || ''}?auto=1`;

    // ─── Delivery ───
    if (!silentlyDiscarded && method === 'email') {
      try {
        const { error: enqueueErr } = await adminClient.from('email_queue').insert({
          email_type: 'ment_received',
          recipient_email,
          recipient_id: null,
          chain_id: null,
          payload: {
            recipient_name: recipient_email.split('@')[0],
            chain_name: '',
            sender_name: senderName,
            compliment_text,
            compliment_category,
            chain_url: baseAppUrl,
            app_url: baseAppUrl,
            ment_id: insertedMent?.id || '',
            reveal_url: revealUrl,
          },
        });
        if (enqueueErr) console.error('[SEND-A-MENT] Enqueue failed:', enqueueErr);
      } catch (enqueueErr) {
        console.error('[SEND-A-MENT] Enqueue threw:', enqueueErr);
      }
    }

    if (!silentlyDiscarded && method === 'text') {
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
      if (!accountSid || !authToken || !fromNumber) {
        console.error('[SEND-A-MENT] Twilio env vars missing — cannot deliver SMS');
        return new Response(
          JSON.stringify({ error: 'sms_not_configured', message: "Text delivery isn't available right now. Try email instead." }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const smsMessage = buildSingleMentShortMessage(revealUrl);
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const twilioResp = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: normalizedPhone!,
          Body: smsMessage,
        }).toString(),
      });

      if (!twilioResp.ok) {
        const errText = await twilioResp.text();
        console.error(`[SEND-A-MENT] Twilio error [${twilioResp.status}]: ${errText}`);
        if (insertedMent?.id) {
          await adminClient.from('sent_ments').delete().eq('id', insertedMent.id);
        }
        return new Response(
          JSON.stringify({ error: 'sms_failed', message: "We couldn't send that text. On a Twilio trial, the number must be verified in your Twilio console." }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, mint_earned: true, new_jar_count: newJarCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEND-A-MENT] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
