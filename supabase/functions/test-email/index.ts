const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[EMAIL DEBUG] test-email function invoked');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const testPayload = {
      email_type: 'chain_received',
      recipient_email: 'brentanddonna@yahoo.com',
      recipient_id: null,
      chain_id: null,
      template_data: {
        recipient_name: 'Donna',
        chain_name: 'Test Chain',
        sender_name: 'Claude',
        compliment_text: 'You are crushing this email setup! 💪',
        chain_url: 'https://ment-maker-mania.lovable.app/chain/test-chain-123',
      },
    };

    console.log('[EMAIL DEBUG] Calling send-email with test data');

    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(testPayload),
    });

    const result = await response.json();
    console.log('[EMAIL DEBUG] send-email response:', response.status, JSON.stringify(result));

    return new Response(
      JSON.stringify({ test: 'complete', status: response.status, result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EMAIL DEBUG] Test error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Test failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
