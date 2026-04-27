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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = authUser.id;
    const userEmail = authUser.email as string;

    const { recipient_email, compliment_text, compliment_category } = await req.json();

    if (!recipient_email || !compliment_text || !compliment_category) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (recipient_email.toLowerCase() === userEmail?.toLowerCase()) {
      return new Response(JSON.stringify({ error: "You can't send a ment to yourself" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Insert sent ment (reusing adminClient from above)

    // Insert sent ment
    const { data: insertedMent, error: insertError } = await adminClient
      .from('sent_ments')
      .insert({
        sender_id: userId,
        recipient_email,
        compliment_text,
        category: compliment_category,
        recipient_type: 'email',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[SEND-A-MENT] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save ment' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Award 1 mint
    const { data: gameState } = await adminClient
      .from('user_game_state')
      .select('jar_count')
      .eq('user_id', userId)
      .single();

    const newJarCount = (gameState?.jar_count ?? 25) + 1;

    await adminClient
      .from('user_game_state')
      .update({ jar_count: newJarCount, total_sent: gameState ? undefined : 1 })
      .eq('user_id', userId);

    // Increment total_sent
    await adminClient.rpc('increment_world_counter');

    // Auto-save contact
    const contactName = recipient_email.split('@')[0];
    const { data: existingContact } = await adminClient
      .from('saved_contacts')
      .select('id, times_sent')
      .eq('user_id', userId)
      .eq('contact_email', recipient_email.toLowerCase())
      .maybeSingle();

    if (existingContact) {
      await adminClient
        .from('saved_contacts')
        .update({ times_sent: existingContact.times_sent + 1, last_sent_at: new Date().toISOString() })
        .eq('id', existingContact.id);
    } else {
      await adminClient
        .from('saved_contacts')
        .insert({ user_id: userId, contact_email: recipient_email.toLowerCase(), contact_name: contactName });
    }

    // Get sender display name
    const { data: senderProfile } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();

    const senderName = senderProfile?.display_name || userEmail?.split('@')[0] || 'Someone';

    // ─── Auto-login token: if recipient already has an account, generate a magic link
    // token and embed it in the reveal URL so they're silently logged in on click.
    let loginToken = '';
    try {
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const recipientUser = existingUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === recipient_email.toLowerCase()
      );
      if (recipientUser) {
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: recipient_email,
        });
        if (!linkError && linkData?.properties?.hashed_token) {
          loginToken = linkData.properties.hashed_token;
        }
      }
    } catch (tokenErr) {
      console.error('[SEND-A-MENT] Token generation failed (non-fatal):', tokenErr);
    }

    const baseAppUrl = 'https://ment-maker-mania.lovable.app';
    const revealUrl = loginToken
      ? `${baseAppUrl}/ment/${insertedMent?.id || ''}?token=${encodeURIComponent(loginToken)}`
      : `${baseAppUrl}/ment/${insertedMent?.id || ''}`;

    // Send email via send-email function
    try {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          email_type: 'ment_received',
          recipient_email,
          recipient_id: null,
          chain_id: null,
          template_data: {
            recipient_name: recipient_email.split('@')[0],
            chain_name: '',
            sender_name: senderName,
            compliment_text,
            compliment_category,
            chain_url: baseAppUrl,
            app_url: baseAppUrl,
            ment_id: insertedMent?.id || '',
            reveal_url: revealUrl,
          },
        }),
      });
      const emailResult = await emailResponse.json();
      console.log('[SEND-A-MENT] Email result:', emailResult);
    } catch (emailErr) {
      console.error('[SEND-A-MENT] Email send failed:', emailErr);
      // Don't fail the whole request if email fails
    }

    return new Response(
      JSON.stringify({ success: true, mint_earned: true, new_jar_count: newJarCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEND-A-MENT] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
