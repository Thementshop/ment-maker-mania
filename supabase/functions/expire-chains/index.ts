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

    // Find and update all expired active chains
    const { data: expiredChains, error } = await supabase
      .from('ment_chains')
      .update({ 
        status: 'broken', 
        broken_at: now 
      })
      .lt('expires_at', now)
      .eq('status', 'active')
      .select('chain_id, chain_name, expires_at');

    if (error) {
      console.error('[expire-chains] Error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const expiredCount = expiredChains?.length || 0;
    console.log(`[expire-chains] Expired ${expiredCount} chains:`, 
      expiredChains?.map(c => c.chain_name || c.chain_id)
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        expired_count: expiredCount,
        expired_chains: expiredChains?.map(c => ({
          chain_id: c.chain_id,
          chain_name: c.chain_name,
          expired_at: c.expires_at
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
