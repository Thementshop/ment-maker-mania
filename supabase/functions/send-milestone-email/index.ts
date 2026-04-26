import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[MILESTONE] send-milestone-email invoked');

    const { chain_id, milestone, creator_email, chain_name, share_count, tier } = await req.json();

    if (!creator_email || !chain_id || !milestone) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const appBaseUrl = 'https://ment-maker-mania.lovable.app';
    const recipientName = creator_email.split('@')[0];

    console.log('[MILESTONE] Chain:', chain_name, 'hit', milestone, 'for', creator_email);

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        email_type: 'milestone',
        recipient_email: creator_email,
        recipient_id: null,
        chain_id,
        template_data: {
          recipient_name: recipientName,
          chain_name: chain_name || 'Kindness Chain',
          milestone,
          total_shares: share_count || milestone,
          tier_status: tier || 'Growing',
          chain_url: `${appBaseUrl}/chain/${chain_id}`,
          share_url: `${appBaseUrl}/chain/${chain_id}`,
        },
      }),
    });

    const result = await response.json();
    console.log('[MILESTONE] Result:', response.status, JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[MILESTONE] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
