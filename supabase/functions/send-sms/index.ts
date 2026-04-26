import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { phone_number, recipient_name, sender_name, reveal_url } = await req.json();

    if (!phone_number || !recipient_name || !sender_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields: phone_number, recipient_name, sender_name' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // TODO: Implement Twilio SMS sending
    // const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    // const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    // const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');
    //
    // Message: "You received a ment from [sender_name]! Tap to reveal: [reveal_url]"

    console.log('[SEND-SMS] Placeholder - would send SMS to:', phone_number);
    console.log('[SEND-SMS] Message:', `You received a ment from ${sender_name}! Tap to reveal: ${reveal_url || 'https://ment-maker-mania.lovable.app'}`);

    return new Response(
      JSON.stringify({ success: true, placeholder: true, message: 'SMS sending not yet configured - Twilio integration pending' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEND-SMS] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
