import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let awarded = 0;
  let skipped = 0;
  const failures: string[] = [];

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: profiles, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, pause_tokens, pause_token_last_awarded_at')
      .or(`pause_token_last_awarded_at.is.null,pause_token_last_awarded_at.lt.${cutoff}`);

    if (fetchErr) throw fetchErr;

    for (const p of profiles ?? []) {
      try {
        const newBalance = (p.pause_tokens ?? 0) + 1;
        const { error: upErr } = await supabase
          .from('profiles')
          .update({
            pause_tokens: newBalance,
            pause_token_last_awarded_at: new Date().toISOString(),
          })
          .eq('id', p.id);

        if (upErr) throw upErr;

        // Mirror to user_game_state if present
        await supabase.rpc('increment_user_game_pause_token', { _user_id: p.id }).then(() => {}, () => {});
        await supabase
          .from('user_game_state')
          .update({ pause_tokens: newBalance })
          .eq('user_id', p.id);

        awarded++;
      } catch (e) {
        skipped++;
        failures.push(`${p.id}: ${(e as Error).message}`);
      }
    }

    await supabase.from('error_log').insert({
      source: 'award-weekly-tokens',
      error_type: 'job_summary',
      severity: 'info',
      message: `Weekly tokens awarded to ${awarded} users`,
      context: { awarded, skipped, failures: failures.slice(0, 20) },
    });

    return new Response(JSON.stringify({ awarded, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    await supabase.from('error_log').insert({
      source: 'award-weekly-tokens',
      error_type: 'job_failure',
      severity: 'error',
      message: (e as Error).message,
      context: { awarded, skipped },
    });
    return new Response(JSON.stringify({ error: (e as Error).message, awarded, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
