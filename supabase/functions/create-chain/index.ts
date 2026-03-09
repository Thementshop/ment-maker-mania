import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CreateChainRequest {
  chainName: string;
  recipientValue: string;
  compliment: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
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

    // Verify user token via admin client (service role key)
    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = user.id;
    console.log('Authenticated user:', userId);

    // Create user-scoped client for RLS-respecting DB operations
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Parse request body
    const body: CreateChainRequest = await req.json();
    const { chainName, recipientValue, compliment } = body;

    if (!recipientValue || !compliment) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipientValue, compliment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating chain:', { chainName, recipientValue, complimentLength: compliment.length });

    // Calculate expiration (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create the chain
    const { data: newChain, error: chainError } = await supabase
      .from('ment_chains')
      .insert({
        chain_name: chainName,
        started_by: userId,
        current_holder: recipientValue,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        share_count: 1,
        tier: 'small',
        links_count: 1
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

    // Create the first link
    const { error: linkError } = await supabase
      .from('chain_links')
      .insert({
        chain_id: newChain.chain_id,
        passed_by: userId,
        passed_to: recipientValue,
        received_compliment: '',
        sent_compliment: compliment,
        was_forwarded: false
      });

    if (linkError) {
      console.error('Link creation error:', linkError);
      // Chain was created, so return partial success
      return new Response(
        JSON.stringify({ 
          chain: newChain, 
          warning: `Chain created but link failed: ${linkError.message}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Link created for chain:', newChain.chain_id);

    // Claim chain name if custom (fire-and-forget)
    if (chainName && chainName.trim()) {
      supabase
        .from('used_chain_names')
        .insert({
          chain_name: chainName,
          chain_id: newChain.chain_id
        })
        .then(({ error }) => {
          if (error) console.warn('Name claim failed:', error);
          else console.log('Name claimed:', chainName);
        });
    }

    // Award +5 mints to creator (create includes first send) - MUST complete before response
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
      
      if (updateErr) console.warn('Creator mint award failed:', updateErr);
      else console.log('Creator awarded +5 mints, new jar:', newJarCount);
    } catch (e) {
      console.error('Mint award error:', e);
    }

    // Award +1 mint to recipient if they have an account (fire-and-forget)
    adminClient.auth.admin.listUsers().then(({ data: userData }) => {
      const recipientUser = userData?.users?.find(
        (u) => u.email && u.email.toLowerCase() === recipientValue.toLowerCase()
      );
      if (!recipientUser) {
        console.log('Recipient not registered, skipping mint award');
        return;
      }
      adminClient
        .from('user_game_state')
        .select('jar_count')
        .eq('user_id', recipientUser.id)
        .maybeSingle()
        .then(({ data: recipientState }) => {
          if (recipientState) {
            adminClient
              .from('user_game_state')
              .update({ jar_count: (recipientState.jar_count ?? 25) + 1 })
              .eq('user_id', recipientUser.id)
              .then(() => console.log('Recipient awarded +1 mint:', recipientUser.id));
          }
        });
    });

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
