import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CreateChainRequest {
  chainName: string;
  recipients: string[];
  recipientValue?: string;
  compliment: string;
  compliments?: string[]; // optional per-recipient compliments (aligned by index)
  complimentCategory?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = user.id;

    const body: CreateChainRequest = await req.json();
    const { chainName, compliment, complimentCategory } = body;
    
    // Accept any email, phone, or contact name — no profile lookup needed
    const recipientList = body.recipients?.length 
      ? body.recipients.map(r => r.trim()).filter(Boolean)
      : body.recipientValue ? [body.recipientValue.trim()] : [];

    if (recipientList.length === 0 || !compliment) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipients, compliment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (recipientList.length > 3) {
      return new Response(
        JSON.stringify({ error: 'Maximum 3 recipients allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lowerRecipients = recipientList.map(r => r.toLowerCase());
    const uniqueRecipients = new Set(lowerRecipients);
    if (uniqueRecipients.size !== lowerRecipients.length) {
      return new Response(
        JSON.stringify({ error: 'Duplicate recipients are not allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userEmail = user.email?.toLowerCase();
    if (userEmail && lowerRecipients.includes(userEmail)) {
      return new Response(
        JSON.stringify({ error: "You can't send a chain to yourself!" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating chain with', recipientList.length, 'recipients');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const finalName = chainName?.trim() || `@${user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}'s Chain`;

    // Use adminClient for all DB operations to bypass RLS and avoid token issues
    const { data: newChain, error: chainError } = await adminClient
      .from('ment_chains')
      .insert({
        chain_name: finalName,
        started_by: userId,
        current_holder: recipientList[0],
        expires_at: expiresAt.toISOString(),
        status: 'active',
        share_count: recipientList.length,
        tier: 'small',
        links_count: recipientList.length,
        compliment_category: complimentCategory || null,
      })
      .select()
      .single();

    if (chainError) {
      console.error('Chain creation error:', chainError);
      return new Response(
        JSON.stringify({ error: `Failed to create chain: ${chainError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Chain created:', newChain.chain_id);

    const linkInserts = recipientList.map(recipient => ({
      chain_id: newChain.chain_id,
      passed_by: userId,
      passed_to: recipient,
      received_compliment: '',
      sent_compliment: compliment,
      was_forwarded: false,
      compliment_category: complimentCategory || null,
    }));

    const { error: linkError } = await adminClient
      .from('chain_links')
      .insert(linkInserts);

    if (linkError) {
      console.error('Link creation error:', linkError);
    }

    // Persist creator reward before responding so the client can show the real updated jar count
    let newJarCount: number | null = null;
    let newTotalSent: number | null = null;

    const { data: gameState } = await adminClient
      .from('user_game_state')
      .select('jar_count, total_sent, chains_started_today, last_chain_start_date')
      .eq('user_id', userId)
      .maybeSingle();

    const now = new Date();
    const lastStart = new Date(gameState?.last_chain_start_date || 0);
    const isNewDay = now.getUTCDate() !== lastStart.getUTCDate() ||
                     now.getUTCMonth() !== lastStart.getUTCMonth() ||
                     now.getUTCFullYear() !== lastStart.getUTCFullYear();

    newJarCount = (gameState?.jar_count ?? 25) + 5;
    newTotalSent = (gameState?.total_sent ?? 0) + 1;

    const { error: creatorRewardError } = await adminClient
      .from('user_game_state')
      .update({
        jar_count: newJarCount,
        total_sent: newTotalSent,
        chains_started_today: isNewDay ? 1 : (gameState?.chains_started_today || 0) + 1,
        last_chain_start_date: now.toISOString()
      })
      .eq('user_id', userId);

    if (creatorRewardError) {
      console.warn('Creator mint award failed:', creatorRewardError);
      newJarCount = null;
      newTotalSent = null;
    } else {
      console.log('Creator awarded +5 mints, new jar:', newJarCount, 'total_sent:', newTotalSent);
    }

    const responsePayload = { chain: newChain, success: true, newJarCount, newTotalSent };

    // Award +1 mint to each recipient who has an account (fire-and-forget)
    for (const recipient of recipientList) {
      adminClient.rpc('award_mint_to_email', { _email: recipient })
        .then(({ error }) => {
          if (error) console.warn('Recipient mint failed for', recipient, error);
        });
    }

    // Claim chain name (fire-and-forget)
    if (finalName) {
      adminClient
        .from('used_chain_names')
        .insert({ chain_name: finalName, chain_id: newChain.chain_id })
        .then(({ error }) => {
          if (error) console.warn('Name claim failed:', error);
        });
    }

    // Enqueue email notifications instead of fanning out direct calls.
    // The process-email-queue worker drains the queue with retries + DLQ.
    const senderName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone';
    const appBaseUrl = 'https://ment-maker-mania.lovable.app';

    const queueRows = recipientList
      .filter((r) => r.includes('@'))
      .map((recipient) => ({
        email_type: 'chain_received',
        recipient_email: recipient,
        recipient_id: null,
        chain_id: newChain.chain_id,
        payload: {
          recipient_name: recipient.split('@')[0],
          chain_name: finalName,
          sender_name: senderName,
          compliment_category: complimentCategory || 'default',
          chain_url: `${appBaseUrl}/chain/${newChain.chain_id}`,
        },
      }));

    if (queueRows.length > 0) {
      adminClient.from('email_queue').insert(queueRows).then(({ error }) => {
        if (error) console.warn('[create-chain] Enqueue failed:', error);
      });
    }

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
