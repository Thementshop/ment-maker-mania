import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '< 1 minute';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} minutes`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[EXPIRING] check-expiring-chains invoked');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Find chains expiring in 1-2 hours
    const now = new Date();
    const oneHour = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const twoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    const { data: expiringChains, error } = await adminClient
      .from('ment_chains')
      .select('chain_id, chain_name, current_holder, expires_at, compliment_category')
      .eq('status', 'active')
      .gte('expires_at', oneHour)
      .lte('expires_at', twoHours);

    if (error) {
      console.error('[EXPIRING] Query error:', error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!expiringChains || expiringChains.length === 0) {
      console.log('[EXPIRING] No chains expiring in 1-2 hours');
      return new Response(JSON.stringify({ message: 'No expiring chains', count: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[EXPIRING] Found', expiringChains.length, 'expiring chains');

    // Group by current_holder
    const grouped: Record<string, typeof expiringChains> = {};
    for (const chain of expiringChains) {
      const holder = chain.current_holder;
      if (!holder) continue;
      if (!grouped[holder]) grouped[holder] = [];
      grouped[holder].push(chain);
    }

    let emailsSent = 0;

    for (const [holder, chains] of Object.entries(grouped)) {
      // Resolve holder email
      let holderEmail = holder;
      let holderName = 'there';

      if (!holder.includes('@')) {
        // It's a UUID, look up email
        const { data: userData } = await adminClient.auth.admin.getUserById(holder);
        if (!userData?.user?.email) {
          console.warn('[EXPIRING] No email for holder:', holder);
          continue;
        }
        holderEmail = userData.user.email;
        holderName = userData.user.user_metadata?.full_name || holderEmail.split('@')[0];
      } else {
        holderName = holder.split('@')[0];
      }

      // Check if already sent warning for any of these chains
      const chainIds = chains.map(c => c.chain_id);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recentWarnings } = await adminClient
        .from('email_logs')
        .select('chain_id')
        .in('chain_id', chainIds)
        .eq('email_type', '1hr_warning')
        .eq('recipient_email', holderEmail)
        .gte('sent_at', twoHoursAgo);

      const alreadyWarned = new Set((recentWarnings || []).map(w => w.chain_id));
      const unwarned = chains.filter(c => !alreadyWarned.has(c.chain_id));

      if (unwarned.length === 0) {
        console.log('[EXPIRING] Already warned', holderEmail);
        continue;
      }

      // Sort by expires_at (soonest first)
      unwarned.sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());

      const appBaseUrl = 'https://ment-maker-mania.lovable.app';
      const urgent = unwarned[0];

      const templateData: Record<string, unknown> = {
        recipient_name: holderName,
        chain_name: urgent.chain_name || 'Kindness Chain',
        chain_url: `${appBaseUrl}/chain/${urgent.chain_id}`,
      };

      if (unwarned.length > 1) {
        templateData.urgent_chain_name = urgent.chain_name || 'Kindness Chain';
        templateData.urgent_time_left = formatTimeLeft(urgent.expires_at);
        templateData.urgent_chain_url = `${appBaseUrl}/chain/${urgent.chain_id}`;
        templateData.other_chains = unwarned.slice(1).map(c => ({
          chain_name: c.chain_name || 'Kindness Chain',
          time_left: formatTimeLeft(c.expires_at),
        }));
        templateData.app_url = appBaseUrl;
      }

      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            email_type: '1hr_warning',
            recipient_email: holderEmail,
            recipient_id: holder.includes('@') ? null : holder,
            chain_id: urgent.chain_id,
            template_data: templateData,
          }),
        });
        emailsSent++;
        console.log('[EXPIRING] Warning sent to', holderEmail, 'for', unwarned.length, 'chains');
      } catch (e) {
        console.error('[EXPIRING] Email failed for', holderEmail, e);
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${emailsSent} warning emails`, count: emailsSent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EXPIRING] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
