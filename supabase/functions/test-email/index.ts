const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[TEST-EMAIL] invoked');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const url = new URL(req.url);
    const emailType = url.searchParams.get('type') || 'chain_received';

    const payloads: Record<string, unknown> = {
      chain_received: {
        email_type: 'chain_received',
        recipient_email: 'brentanddonna@yahoo.com',
        recipient_id: null,
        chain_id: null,
        template_data: {
          recipient_name: 'Donna',
          chain_name: 'Sunshine Vibes',
          sender_name: 'Brent',
          compliment_category: 'encouragement',
          chain_url: 'https://ment-maker-mania.lovable.app/chain/test-chain-123',
        },
      },
      '1hr_warning': {
        email_type: '1hr_warning',
        recipient_email: 'brentanddonna@yahoo.com',
        recipient_id: null,
        chain_id: null,
        template_data: {
          recipient_name: 'Donna',
          chain_name: 'Sunshine Vibes',
          chain_url: 'https://ment-maker-mania.lovable.app/chain/test-chain-123',
        },
      },
      milestone: {
        email_type: 'milestone',
        recipient_email: 'brentanddonna@yahoo.com',
        recipient_id: null,
        chain_id: null,
        template_data: {
          recipient_name: 'Donna',
          chain_name: 'Sunshine Vibes',
          milestone: 50,
          total_shares: 52,
          tier_status: 'On Fire',
          chain_url: 'https://ment-maker-mania.lovable.app/chain/test-chain-123',
        },
      },
      completed: {
        email_type: 'completed',
        recipient_email: 'brentanddonna@yahoo.com',
        recipient_id: null,
        chain_id: null,
        template_data: {
          recipient_name: 'Donna',
          chain_name: 'Sunshine Vibes',
          total_shares: 12,
          app_url: 'https://ment-maker-mania.lovable.app',
          chain_url: 'https://ment-maker-mania.lovable.app/chain/test-chain-123',
          compliments: [
            { text: 'You light up every room!', sender_name: 'Brent' },
            { text: 'Your smile is contagious', sender_name: 'Sarah' },
          ],
        },
      },
    };

    const testPayload = payloads[emailType] || payloads.chain_received;

    console.log('[TEST-EMAIL] Sending type:', emailType);

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(testPayload),
    });

    const result = await response.json();
    console.log('[TEST-EMAIL] Result:', response.status, JSON.stringify(result));

    return new Response(
      JSON.stringify({ test: 'complete', type: emailType, status: response.status, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TEST-EMAIL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Test failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
