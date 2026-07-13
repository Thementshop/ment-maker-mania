import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Normalize a phone number: strip spaces/dashes/parens, ensure it starts with "+".
// Defaults a bare 10-digit US number to +1.
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  if (!cleaned.startsWith('+')) {
    // Bare digits — assume US if 10 digits, otherwise prefix "+".
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 10) cleaned = '+1' + digits;
    else cleaned = '+' + digits;
  }
  // Final sanity check: + followed by 8–15 digits.
  if (!/^\+\d{8,15}$/.test(cleaned)) return null;
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const phoneNumber = normalizePhone(body?.phone_number ?? '');
    if (!phoneNumber) {
      return new Response(JSON.stringify({ error: 'invalid_phone', message: "That doesn't look like a valid phone number." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Rate limit: max 5 codes per user per hour.
    const { count: userCount } = await adminClient
      .from('phone_verification_codes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);
    if ((userCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'rate_limited', message: 'Too many attempts. Try again in an hour.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: max 5 codes per phone number (any user) per hour.
    const { count: phoneCount } = await adminClient
      .from('phone_verification_codes')
      .select('id', { count: 'exact', head: true })
      .eq('phone_number', phoneNumber)
      .gte('created_at', oneHourAgo);
    if ((phoneCount ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: 'rate_limited', message: 'Too many attempts. Try again in an hour.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate a cryptographically-random 6-digit code.
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const code = (arr[0] % 1000000).toString().padStart(6, '0');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await adminClient
      .from('phone_verification_codes')
      .insert({ user_id: userId, phone_number: phoneNumber, code, expires_at: expiresAt });
    if (insertError) {
      console.error('[send-phone-code] insert failed:', insertError);
      return new Response(JSON.stringify({ error: 'server_error', message: 'Something went sideways on our end. Give it another shot in a minute.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Send SMS via Twilio REST API ──
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    if (!accountSid || !authToken || !fromNumber) {
      console.error('[send-phone-code] Twilio env vars missing');
      return new Response(JSON.stringify({ error: 'server_error', message: 'Something went sideways on our end. Give it another shot in a minute.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioBody = new URLSearchParams({
      From: fromNumber,
      To: phoneNumber,
      Body: `Your Ment Shop code is: ${code}. It expires in 10 minutes.`,
    });

    const twilioResp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: twilioBody.toString(),
    });

    if (!twilioResp.ok) {
      const errText = await twilioResp.text();
      console.error(`[send-phone-code] Twilio error [${twilioResp.status}]: ${errText}`);
      return new Response(JSON.stringify({ error: 'sms_failed', message: 'Something went sideways on our end. Give it another shot in a minute.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Never return the code to the client.
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-phone-code] Error:', error);
    return new Response(JSON.stringify({ error: 'server_error', message: 'Something went sideways on our end. Give it another shot in a minute.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
