import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let cleaned = raw.trim().replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  if (!cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length === 10) cleaned = '+1' + digits;
    else cleaned = '+' + digits;
  }
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
    const submittedCode = String(body?.code ?? '').trim();

    if (!phoneNumber || !/^\d{6}$/.test(submittedCode)) {
      return new Response(JSON.stringify({ error: 'wrong_code', message: "Hmm, that code didn't match. Double-check and try again." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Most recent unverified, unexpired code for this user + number.
    const { data: row } = await adminClient
      .from('phone_verification_codes')
      .select('id, code, attempts')
      .eq('user_id', userId)
      .eq('phone_number', phoneNumber)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ error: 'expired_or_not_found', message: "That code expired. Tap 'Resend' and we'll send a fresh one." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment attempts.
    const newAttempts = (row.attempts ?? 0) + 1;
    await adminClient
      .from('phone_verification_codes')
      .update({ attempts: newAttempts })
      .eq('id', row.id);

    if (newAttempts > 5) {
      return new Response(JSON.stringify({ error: 'too_many_attempts', message: "Too many tries — let's take a breather. Try again in 15 minutes." }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (row.code !== submittedCode) {
      return new Response(JSON.stringify({ error: 'wrong_code', message: "Hmm, that code didn't match. Double-check and try again." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Correct code — mark verified and update profile.
    await adminClient
      .from('phone_verification_codes')
      .update({ verified: true })
      .eq('id', row.id);

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        phone_number: phoneNumber,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[check-phone-code] profile update failed:', profileError);
      // If the number collides with another account's unique phone, surface a clear error.
      if ((profileError as { code?: string }).code === '23505') {
        return new Response(JSON.stringify({ error: 'phone_in_use', message: 'That number is already verified on another account.' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'server_error', message: 'Something went sideways on our end. Give it another shot in a minute.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[check-phone-code] Error:', error);
    return new Response(JSON.stringify({ error: 'server_error', message: 'Something went sideways on our end. Give it another shot in a minute.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
