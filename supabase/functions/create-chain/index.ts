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

    // Create admin client with service role key for auth verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token via claims (faster, avoids getUser network call)
    const token = authHeader.replace('Bearer ', '');
    
    // Create a user-scoped client to verify claims
    const claimsClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await claimsClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = claimsData.claims.sub as string;
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

    // Update user stats (fire-and-forget)
    const now = new Date();
    supabase
      .from('user_game_state')
      .select('chains_started_today, last_chain_start_date')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data: gameState }) => {
        const lastStart = new Date(gameState?.last_chain_start_date || 0);
        const isNewDay = now.getUTCDate() !== lastStart.getUTCDate() ||
                         now.getUTCMonth() !== lastStart.getUTCMonth() ||
                         now.getUTCFullYear() !== lastStart.getUTCFullYear();
        
        return supabase
          .from('user_game_state')
          .update({
            chains_started_today: isNewDay ? 1 : (gameState?.chains_started_today || 0) + 1,
            last_chain_start_date: now.toISOString()
          })
          .eq('user_id', user.id);
      })
      .then(({ error }) => {
        if (error) console.warn('Stats update failed:', error);
        else console.log('Stats updated for user:', user.id);
      });

    return new Response(
      JSON.stringify({ chain: newChain, success: true }),
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
