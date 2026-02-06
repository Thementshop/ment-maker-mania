import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date().toISOString();
    console.log(`[expire-chains] Running at ${now}`);

    // First, get chains that are about to expire so we can capture the current_holder
    const { data: chainsToExpire, error: fetchError } = await supabase
      .from('ment_chains')
      .select('chain_id, chain_name, current_holder, started_by, share_count')
      .lt('expires_at', now)
      .eq('status', 'active');

    if (fetchError) {
      console.error('[expire-chains] Error fetching chains:', fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!chainsToExpire || chainsToExpire.length === 0) {
      console.log('[expire-chains] No chains to expire');
      return new Response(
        JSON.stringify({ success: true, expired_count: 0 }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update each chain with broken_by set to current_holder
    const expiredChains = [];
    for (const chain of chainsToExpire) {
      const { error: updateError } = await supabase
        .from('ment_chains')
        .update({ 
          status: 'broken', 
          broken_at: now,
          broken_by: chain.current_holder // Track who broke the chain
        })
        .eq('chain_id', chain.chain_id);

      if (updateError) {
        console.error(`[expire-chains] Error updating chain ${chain.chain_id}:`, updateError);
      } else {
        expiredChains.push(chain);
        console.log(`[expire-chains] Chain "${chain.chain_name || chain.chain_id}" broken by ${chain.current_holder}`);
      }
    }

    const expiredCount = expiredChains.length;
    console.log(`[expire-chains] Expired ${expiredCount} chains`);

    return new Response(
      JSON.stringify({ 
        success: true,
        expired_count: expiredCount,
        expired_chains: expiredChains.map(c => ({
          chain_id: c.chain_id,
          chain_name: c.chain_name,
          broken_by: c.current_holder,
          share_count: c.share_count
        }))
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('[expire-chains] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});