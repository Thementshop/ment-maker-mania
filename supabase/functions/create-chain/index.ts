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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const body: CreateChainRequest = await req.json();
    const { chainName, compliment, complimentCategory } = body;
    
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
        JSON.stringify({ error: 'Duplicate recipients are not allowed. Each person should be unique!' }),
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

    console.log('Creating chain with', recipientList.length, 'recipients, category:', complimentCategory);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { data: newChain, error: chainError } = await supabase
      .from('ment_chains')
      .insert({
        chain_name: chainName,
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

    const { error: linkError } = await supabase
      .from('chain_links')
      .insert(linkInserts);

    if (linkError) {
      console.error('Link creation error:', linkError);
      return new Response(
        JSON.stringify({ 
          chain: newChain, 
          warning: `Chain created but links failed: ${linkError.message}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created', recipientList.length, 'links for chain:', newChain.chain_id);

    // Claim chain name (fire-and-forget)
    if (chainName && chainName.trim()) {
      supabase
        .from('used_chain_names')
        .insert({ chain_name: chainName, chain_id: newChain.chain_id })
        .then(({ error }) => {
          if (error) console.warn('Name claim failed:', error);
        });
    }

    // Award +5 mints to creator
    console.log('[MINT DEBUG] Starting mint award for creator:', userId);
    const now = new Date();
    let newJarCount = 25;
    try {
      const { data: gameState } = await adminClient
        .from('user_game_state')
        .select('jar_count, chains_started_today, last_chain_start_date')
        .eq('user_id', userId)
        .maybeSingle();
      
      const lastStart = new Date(gameState?.last_chain_start_date || 0);
      const isNewDay = now.getUTCDate() !== lastStart.getUTCDate() ||
                       now.getUTCMonth() !== lastStart.getUTCMonth() ||
                       now.getUTCFullYear() !== lastStart.getUTCFullYear();
      
      const currentJar = gameState?.jar_count ?? 25;
      newJarCount = currentJar + 5;
      
      const { error: updateErr } = await adminClient
        .from('user_game_state')
        .update({
          jar_count: newJarCount,
          chains_started_today: isNewDay ? 1 : (gameState?.chains_started_today || 0) + 1,
          last_chain_start_date: now.toISOString()
        })
        .eq('user_id', userId);
      
      if (updateErr) console.warn('[MINT DEBUG] Creator mint award FAILED:', updateErr);
      else console.log('[MINT DEBUG] Creator awarded +5 mints, new jar:', newJarCount);
    } catch (e) {
      console.error('[MINT DEBUG] Mint award exception:', e);
    }

    // Award +1 mint to each recipient who has an account (fire-and-forget)
    for (const recipient of recipientList) {
      adminClient.rpc('award_mint_to_email', { _email: recipient })
        .then(({ data, error }) => {
          if (error) console.warn('Recipient mint award failed for', recipient, error);
          else console.log('Recipient mint award for', recipient, ':', data);
        });
    }

    // Send email notifications to email recipients (fire-and-forget)
    const senderName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone';
    const appBaseUrl = 'https://ment-maker-mania.lovable.app';
    
    for (const recipient of recipientList) {
      if (recipient.includes('@')) {
        const recipientName = recipient.split('@')[0];
        fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            email_type: 'chain_received',
            recipient_email: recipient,
            recipient_id: null,
            chain_id: newChain.chain_id,
            template_data: {
              recipient_name: recipientName,
              chain_name: chainName || `@${senderName}'s Chain`,
              sender_name: senderName,
              compliment_category: complimentCategory || 'default',
              chain_url: `${appBaseUrl}/chain/${newChain.chain_id}`,
            },
          }),
        }).then(r => r.text()).then(t => {
          console.log('Email sent to', recipient, ':', t);
        }).catch(e => {
          console.warn('Email send failed for', recipient, ':', e);
        });
      }
    }

    return new Response(
      JSON.stringify({ chain: newChain, success: true, newJarCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
