import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { checkComplimentContent } from '../_shared/contentFilter.ts';
import { buildSingleMentShortMessage } from '../_shared/notification-copy.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
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
    // A user cannot send until they've verified a real phone number. Checked
    // BEFORE any processing so unverified users never reach the send logic.
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
    const { recipient_email, recipient_phone, delivery_method, compliment_text, compliment_category } = body;

    // Default to email delivery for backward compatibility. Only "text" switches to SMS.
    const method: 'email' | 'text' = delivery_method === 'text' ? 'text' : 'email';

    if (!compliment_text || !compliment_category) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Resolve + validate the recipient identifier for the chosen channel.
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

    // ─── Content filter (authoritative security boundary) ───
    // Even though the UI only sends ready-made compliments here, compliment_text is
    // fully client-controlled. Anyone hitting this endpoint directly (curl/devtools)
    // could otherwise ship arbitrary text. Run the same shared filter as
    // validate-custom-ment / create-chain — fail-closed: blocked → never sent.
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



    // ─── Blocked-sender enforcement ───
    // If the recipient has blocked this sender, silently discard: the send appears
    // to succeed and the sender still earns their mint, but nothing is stored or
    // delivered to the recipient, and the sender is never told they were blocked.
    let silentlyDiscarded = false;
    if (method === 'email') {
      try {
        const { data: blocked } = await adminClient.rpc('is_blocked_by_email', {
          _sender: userId,
          _recipient_email: recipient_email,
        });
        silentlyDiscarded = blocked === true;
      } catch (blockErr) {
        console.error('[SEND-A-MENT] block check failed:', blockErr);
      }
    }

    // ─── Admin ban enforcement ───
    // If this sender has been banned by an admin, silently discard: return success
    // so the sender is never told, but nothing is stored or delivered.
    try {
      const { data: bannedRow } = await adminClient
        .from('profiles')
        .select('is_banned')
        .eq('id', userId)
        .maybeSingle();
      if (bannedRow?.is_banned === true) silentlyDiscarded = true;
    } catch (banErr) {
      console.error('[SEND-A-MENT] ban check failed:', banErr);
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


    const { error: mintTransactionError } = await adminClient
      .from('mint_transactions')
      .insert({
        user_id: userId,
        amount: 1,
        reason: 'send',
      });

    if (mintTransactionError) {
      console.error('[SEND-A-MENT] Mint transaction error:', mintTransactionError);
    }

    // Award +1 mint to recipient (if they have an account). Fire-and-forget.
    // Skipped when silently discarded so a blocked recipient gets nothing.
    if (!silentlyDiscarded) {
      adminClient.rpc('award_mint_to_email', { _email: recipient_email })
        .then(({ error }: { error: unknown }) => {
          if (error) console.warn('[SEND-A-MENT] Recipient mint award failed:', error);
        });
    }



    // Keep legacy user game state counters in sync for the existing UI/store
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

    // Increment total_sent
    await adminClient.rpc('increment_world_counter');

    // Auto-save contact
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

    // Get sender display name
    const { data: senderProfile } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();

    const senderName = senderProfile?.display_name || userEmail?.split('@')[0] || 'Someone';

    // ─── Lazy auto-login: skip token generation here. The reveal URL uses ?auto=1
    // and the issue-reveal-token edge function generates/caches a token at click-time.
    // This removes auth.admin.listUsers() and auth.admin.generateLink() from the hot path.
    const baseAppUrl = 'https://ment-maker-mania.lovable.app';
    const revealUrl = `${baseAppUrl}/ment/${insertedMent?.id || ''}?auto=1`;

    // Enqueue email instead of calling send-email directly. The process-email-queue
    // worker (pg_cron, every minute) drains the queue with retries + DLQ.
    // Skipped when silently discarded so a blocked recipient is never emailed.
    if (!silentlyDiscarded) {
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
        // Don't fail the whole request if enqueue fails — the user-facing send still succeeded.
      }
    }


    return new Response(
      JSON.stringify({ success: true, mint_earned: true, new_jar_count: newJarCount, new_total_sent: newTotalSent }),
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
