import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { checkComplimentContent } from '../_shared/contentFilter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: this function is the ONLY path a custom (user-typed) compliment may
  // take into the database. If anything goes wrong, the compliment is BLOCKED by
  // default and never sent.
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ─── Auth ───
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ approved: false, error: 'Unauthorized' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authUser) {
      return json({ approved: false, error: 'Unauthorized' }, 401);
    }
    const userId = authUser.id;
    const userEmail = authUser.email as string;

    const { recipient_email, compliment_text, compliment_category } = await req.json();

    if (!recipient_email || !compliment_text) {
      return json({ approved: false, error: 'Missing required fields' }, 400);
    }
    if (recipient_email.toLowerCase() === userEmail?.toLowerCase()) {
      return json({ approved: false, error: "You can't send a ment to yourself" }, 400);
    }

    // ─── Content filter (authoritative security boundary) ───
    const check = checkComplimentContent(compliment_text);
    if (check.blocked) {
      // Persist the block event. Do NOT expose the trigger term to the client.
      try {
        await adminClient.from('content_block_log').insert({
          user_id: userId,
          blocked_text: compliment_text,
          trigger_term: check.match ?? '',
          match_type: check.reason ?? 'unknown',
        });
      } catch (logErr) {
        console.error('[VALIDATE-CUSTOM-MENT] block-log insert failed:', logErr);
      }
      // Blocked → never inserted, never sent.
      return json({ approved: false });
    }

    // ─── Blocked-sender enforcement ───
    // If the recipient has blocked this sender, silently discard: the send appears
    // to succeed and the sender still earns their mint, but nothing is stored or
    // delivered to the recipient, and the sender is never told they were blocked.
    let silentlyDiscarded = false;
    try {
      const { data: blocked } = await adminClient.rpc('is_blocked_by_email', {
        _sender: userId,
        _recipient_email: recipient_email,
      });
      silentlyDiscarded = blocked === true;
    } catch (blockErr) {
      console.error('[VALIDATE-CUSTOM-MENT] block check failed:', blockErr);
    }

    // ─── Admin ban enforcement ───
    // If this sender has been banned by an admin, silently discard the send:
    // return success so the sender is never told, but deliver nothing.
    try {
      const { data: bannedRow } = await adminClient
        .from('profiles')
        .select('is_banned')
        .eq('id', userId)
        .maybeSingle();
      if (bannedRow?.is_banned === true) silentlyDiscarded = true;
    } catch (banErr) {
      console.error('[VALIDATE-CUSTOM-MENT] ban check failed:', banErr);
    }

    const category = compliment_category || 'custom';
    let insertedMentId = '';

    if (!silentlyDiscarded) {
      // Insert the validated Ment (service role — only writer for custom text).
      const { data: insertedMent, error: insertError } = await adminClient
        .from('sent_ments')
        .insert({
          sender_id: userId,
          recipient_email,
          compliment_text,
          category,
          recipient_type: 'email',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[VALIDATE-CUSTOM-MENT] Insert error:', insertError);
        return json({ approved: false, error: 'Failed to save ment' }, 500);
      }
      insertedMentId = insertedMent?.id || '';

      // Award +1 mint to recipient (if they have an account). Fire-and-forget.
      adminClient.rpc('award_mint_to_email', { _email: recipient_email })
        .then(({ error }: { error: unknown }) => {
          if (error) console.warn('[VALIDATE-CUSTOM-MENT] Recipient mint award failed:', error);
        });
    }

    // ─── Sender always earns their mint (even when silently discarded) ───
    const { error: mintTransactionError } = await adminClient
      .from('mint_transactions')
      .insert({ user_id: userId, amount: 1, reason: 'send' });
    if (mintTransactionError) {
      console.error('[VALIDATE-CUSTOM-MENT] Mint transaction error:', mintTransactionError);
    }

    // Keep legacy game-state counters in sync for the existing UI/store.
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

    // ─── Auto-save contact ───
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

    // If silently discarded, stop here — no email is delivered to the recipient.
    if (silentlyDiscarded) {
      return json({ approved: true, mint_earned: true, new_jar_count: newJarCount, new_total_sent: newTotalSent });
    }

    // ─── Enqueue the delivery email ───
    const { data: senderProfile } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    const senderName = senderProfile?.display_name || userEmail?.split('@')[0] || 'Someone';

    const baseAppUrl = 'https://ment-maker-mania.lovable.app';
    const revealUrl = `${baseAppUrl}/ment/${insertedMentId}?auto=1`;

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
          compliment_category: category,
          chain_url: baseAppUrl,
          app_url: baseAppUrl,
          ment_id: insertedMentId,
          reveal_url: revealUrl,
        },
      });
      if (enqueueErr) console.error('[VALIDATE-CUSTOM-MENT] Enqueue failed:', enqueueErr);
    } catch (enqueueErr) {
      console.error('[VALIDATE-CUSTOM-MENT] Enqueue threw:', enqueueErr);
    }

    return json({ approved: true, mint_earned: true, new_jar_count: newJarCount, new_total_sent: newTotalSent });
  } catch (error) {
    console.error('[VALIDATE-CUSTOM-MENT] Error:', error);
    // Fail closed: never let an error result in an unvalidated send.
    return json({ approved: false, error: (error as Error).message || 'Internal server error' }, 500);
  }
});
