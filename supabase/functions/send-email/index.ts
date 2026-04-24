import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface OtherChain {
  chain_name: string;
  time_left: string;
}

interface ComplimentEntry {
  text: string;
  sender_name: string;
}

interface TemplateData {
  recipient_name: string;
  chain_name: string;
  sender_name?: string;
  compliment_text?: string;
  compliment_category?: string;
  chain_url: string;
  app_url?: string;
  share_url?: string;
  milestone?: number;
  total_shares?: number;
  tier_status?: string;
  count?: number;
  urgent_chain_name?: string;
  urgent_time_left?: string;
  urgent_chain_url?: string;
  other_chains?: OtherChain[];
  compliments?: ComplimentEntry[];
  personal_note?: string;
  ment_id?: string;
}

interface SendEmailRequest {
  email_type: 'chain_received' | '1hr_warning' | 'milestone' | 'completed' | 'ment_received';
  recipient_email: string;
  recipient_id: string | null;
  chain_id: string | null;
  template_data: TemplateData;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Subjects ───
function getSubject(emailType: string, data: TemplateData): string {
  switch (emailType) {
    case 'chain_received':
      return `⏰ You have 24 hours to keep the ${data.chain_name} chain alive`;
    case 'ment_received':
      return `${data.sender_name || 'Someone'} thought of you — open this when you're ready`;
    case '1hr_warning':
      if (data.other_chains && data.other_chains.length > 0) {
        return `⏰ ${(data.other_chains.length + 1)} of your chains are about to break`;
      }
      return `⏰ 1 hour left — don't let the ${data.chain_name} chain break`;
    case 'milestone':
      return `🏆 Your ${data.chain_name} chain just hit ${data.milestone} shares`;
    case 'completed':
      return `Your ${data.chain_name} chain reached ${data.total_shares || 0} people`;
    default:
      return "You've received something special from Ment Shop";
  }
}

// ─── Shared brand assets ───
const MINT_IMG = 'https://ment-maker-mania.lovable.app/images/mint-candy.png';
const BRAND_DARK = '#1a1a1a';        // body text
const BRAND_HEADER = '#0d3d18';      // deep candy green header band
const BRAND_GREEN = '#58fc59';       // Screamin' Green accent
const PAGE_BG = '#f9fff9';           // soft minty page background
const CARD_BG = '#ffffff';

// ─── Header (deep green band with mint logo) ───
function brandHeader(eyebrow: string): string {
  return `
  <tr><td style="background-color:${BRAND_HEADER};padding:32px 30px;text-align:center;border-bottom:4px solid ${BRAND_GREEN};">
    <img src="${MINT_IMG}" width="64" height="64" alt="" style="display:block;margin:0 auto 12px;width:64px;height:64px;">
    <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">MENT SHOP</h1>
    <p style="color:${BRAND_GREEN};margin:6px 0 0;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
  </td></tr>`;
}

// ─── FOOTER (light) ───
const footer = `
<tr><td style="background-color:#f3faf3;padding:24px 30px;text-align:center;border-top:1px solid #e5f3e5;">
  <p style="color:#4b5563;font-size:11px;line-height:1.6;margin:0 0 6px;letter-spacing:0.5px;">
    MENT SHOP &nbsp;·&nbsp; A chain of kindness, passed person to person.
  </p>
  <p style="color:#6b7280;font-size:11px;margin:0;">
    Questions? <a href="mailto:info@mentshop.com" style="color:${BRAND_HEADER};text-decoration:none;font-weight:600;">info@mentshop.com</a>
  </p>
</td></tr>`;

// ─── Shared shell ───
function shell(eyebrow: string, innerHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE_BG};padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:${CARD_BG};border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(13,61,24,0.12);">
  ${brandHeader(eyebrow)}
  <tr><td style="padding:0 30px;">${innerHtml}</td></tr>
  ${footer}
</table>
</td></tr></table></body></html>`;
}

// ─── Reusable bits ───
function urgencyBanner(eyebrow: string, message: string): string {
  return `
    <div style="background:linear-gradient(135deg,#dc2626,#ea580c);border-radius:12px;padding:18px 22px;margin:28px 0 24px;text-align:center;box-shadow:0 6px 20px rgba(220,38,38,0.25);">
      <p style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px;">${escapeHtml(eyebrow)}</p>
      <p style="color:#ffffff;font-size:15px;font-weight:600;margin:0;line-height:1.4;">${escapeHtml(message)}</p>
    </div>`;
}

function primaryCTA(href: string, label: string, subtext?: string): string {
  return `
    <div style="text-align:center;margin:0 0 32px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;background-color:${BRAND_GREEN};color:${BRAND_HEADER};text-decoration:none;padding:18px 44px;border-radius:999px;font-size:17px;font-weight:800;letter-spacing:0.3px;border:2px solid ${BRAND_HEADER};box-shadow:0 6px 18px rgba(88,252,89,0.35);">
        ${escapeHtml(label)} →
      </a>
      ${subtext ? `<p style="color:#4b5563;font-size:13px;margin:14px 0 0;line-height:1.5;">${subtext}</p>` : ''}
    </div>`;
}

// ─── TEMPLATE 1: Chain Received (Premium / Urgent) ───
function buildChainReceivedEmail(data: TemplateData): string {
  const chainName = escapeHtml(data.chain_name);
  const inner = `
    ${urgencyBanner('⏰ 24-Hour Window', 'Pass it forward within 24 hours or the chain breaks.')}
    <h2 style="color:${BRAND_DARK};margin:0 0 12px;font-size:30px;font-weight:800;line-height:1.15;letter-spacing:-0.8px;">
      ⚡ ${chainName} Chain
    </h2>
    <p style="color:${BRAND_DARK};font-size:18px;line-height:1.5;margin:0 0 8px;font-weight:600;">
      Hey ${escapeHtml(data.recipient_name)} — you're the next link.
    </p>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 28px;">
      Someone hand-picked you to receive this kindness. The chain is alive in your hands now. Keep it going.
    </p>
    ${primaryCTA(data.chain_url, 'Reveal Your Compliment', 'Tap to open your message')}
    <div style="border-top:1px solid #e5e7eb;padding:22px 0 28px;">
      <p style="color:${BRAND_DARK};font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">A chain of kindness</p>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">
        Passed person to person. You were chosen — now choose someone else.
      </p>
    </div>`;
  return shell('A Chain Just Reached You', inner);
}

// ─── TEMPLATE 2a: 1hr Warning (Single) ───
function build1hrWarningSingleEmail(data: TemplateData): string {
  const inner = `
    ${urgencyBanner('⏰ 1 Hour Remaining', `The ${data.chain_name} chain breaks if it isn't passed forward.`)}
    <h2 style="color:${BRAND_DARK};margin:0 0 12px;font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-0.6px;">
      Don't let it break, ${escapeHtml(data.recipient_name)}.
    </h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 28px;">
      Your "${escapeHtml(data.chain_name)}" chain has less than an hour left. One quick pass keeps the kindness alive.
    </p>
    ${primaryCTA(data.chain_url, 'Pass It Forward', 'Or use a pause token to reset the timer')}
  `;
  return shell('Time is Running Out', inner);
}

// ─── TEMPLATE 2b: 1hr Warning (Batched) ───
function build1hrWarningBatchedEmail(data: TemplateData): string {
  const otherChainsHtml = (data.other_chains || []).map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1f2f1f;">
      <p style="color:#ffffff;font-size:14px;font-weight:600;margin:0;">${escapeHtml(c.chain_name)}</p>
      <p style="color:${BRAND_GREEN};font-size:13px;margin:0;font-weight:700;">${escapeHtml(c.time_left)}</p>
    </div>
  `).join('');

  const appUrl = data.app_url || 'https://ment-maker-mania.lovable.app';
  const inner = `
    ${urgencyBanner('⚡ Multiple Chains Expiring', `${(data.other_chains?.length || 0) + 1} chains need your attention right now.`)}
    <h2 style="color:${BRAND_DARK};margin:0 0 20px;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
      Most urgent
    </h2>
    <div style="background-color:${BRAND_DARK};border-radius:12px;padding:22px;margin:0 0 20px;">
      <p style="color:#ffffff;font-size:18px;font-weight:700;margin:0 0 6px;">${escapeHtml(data.urgent_chain_name || data.chain_name)}</p>
      <p style="color:${BRAND_GREEN};font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 16px;">${escapeHtml(data.urgent_time_left || '< 1 hour')} left</p>
      <a href="${escapeHtml(data.urgent_chain_url || data.chain_url)}" style="display:inline-block;background-color:${BRAND_GREEN};color:${BRAND_DARK};text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:800;letter-spacing:0.5px;">
        Pass This Chain →
      </a>
    </div>
    <p style="color:${BRAND_DARK};font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin:24px 0 12px;">Also expiring soon</p>
    <div style="background-color:${BRAND_DARK};border-radius:12px;padding:8px 22px;margin:0 0 28px;">
      ${otherChainsHtml}
    </div>
    ${primaryCTA(appUrl, 'View All Your Chains')}
  `;
  return shell('Multiple Chains Need You', inner);
}

// ─── TEMPLATE 3: Milestone ───
function buildMilestoneEmail(data: TemplateData): string {
  const inner = `
    <div style="background:linear-gradient(135deg,${BRAND_GREEN},#22c55e);border-radius:12px;padding:24px 22px;margin:28px 0 24px;text-align:center;">
      <p style="color:${BRAND_DARK};font-size:12px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;margin:0 0 8px;">🏆 Milestone Reached</p>
      <p style="color:${BRAND_DARK};font-size:48px;font-weight:900;margin:0;line-height:1;letter-spacing:-2px;">${data.milestone}</p>
      <p style="color:${BRAND_DARK};font-size:13px;font-weight:700;margin:8px 0 0;">people reached</p>
    </div>
    <h2 style="color:${BRAND_DARK};margin:0 0 12px;font-size:28px;font-weight:800;letter-spacing:-0.6px;line-height:1.2;">
      ${escapeHtml(data.recipient_name)}, your chain is on fire.
    </h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 28px;">
      "${escapeHtml(data.chain_name)}" just hit <strong>${data.milestone}</strong> shares. That's ${data.milestone} smiles, all because you started it.
    </p>
    <div style="background-color:#f9fafb;border-radius:12px;padding:18px;text-align:center;margin:0 0 28px;">
      <p style="color:${BRAND_DARK};font-size:32px;font-weight:900;margin:0;letter-spacing:-1px;">${data.total_shares || data.milestone}</p>
      <p style="color:#6b7280;font-size:13px;margin:4px 0 0;letter-spacing:0.5px;">total shares · ${escapeHtml(data.tier_status || 'Growing')}</p>
    </div>
    ${primaryCTA(data.chain_url, 'View Your Chain')}
  `;
  return shell('Your Chain Hit a Milestone', inner);
}

// ─── TEMPLATE 4: Chain Completed ───
function buildCompletedEmail(data: TemplateData): string {
  const complimentsHtml = (data.compliments || []).map(c => `
    <div style="background-color:#f9fafb;border-left:3px solid ${BRAND_GREEN};border-radius:6px;padding:14px 18px;margin:0 0 10px;">
      <p style="color:${BRAND_DARK};font-size:15px;font-style:italic;line-height:1.5;margin:0;">"${escapeHtml(c.text)}"</p>
      <p style="color:#9ca3af;font-size:12px;margin:6px 0 0;letter-spacing:0.5px;">— @${escapeHtml(c.sender_name)}</p>
    </div>
  `).join('');

  const appUrl = data.app_url || 'https://ment-maker-mania.lovable.app';
  const inner = `
    <div style="margin:28px 0 24px;text-align:center;">
      <p style="color:${BRAND_DARK};font-size:12px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;margin:0 0 8px;">Chain Complete</p>
      <p style="color:${BRAND_DARK};font-size:64px;font-weight:900;margin:0;line-height:1;letter-spacing:-3px;">${data.total_shares || 0}</p>
      <p style="color:#6b7280;font-size:14px;margin:8px 0 0;">people received your kindness</p>
    </div>
    <h2 style="color:${BRAND_DARK};margin:0 0 12px;font-size:26px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">
      Look what you started, ${escapeHtml(data.recipient_name)}.
    </h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Your "${escapeHtml(data.chain_name)}" chain has ended. Here's every compliment it carried.
    </p>
    ${complimentsHtml ? `<div style="margin:0 0 28px;">${complimentsHtml}</div>` : ''}
    ${primaryCTA(appUrl, 'Start Another Chain')}
  `;
  return shell('A Chain You Started Has Ended', inner);
}

// ─── TEMPLATE 5: Ment Received (Single Compliment) ───
function buildMentReceivedEmail(data: TemplateData): string {
  const appUrl = data.app_url || 'https://ment-maker-mania.lovable.app';
  const sender = data.sender_name && data.sender_name.trim().length > 0
    ? data.sender_name
    : 'Someone';
  const revealUrl = `${appUrl}/ment/${data.ment_id || ''}`;
  const inner = `
    <h2 style="color:${BRAND_DARK};margin:32px 0 14px;font-size:28px;font-weight:800;line-height:1.25;letter-spacing:-0.6px;">
      ${escapeHtml(sender)} thought of you and wrapped something kind just for you.
    </h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 32px;">
      Take a quiet moment. Open it when you're ready.
    </p>
    ${primaryCTA(revealUrl, 'Unwrap Your Ment', 'No account needed. This was made just for you.')}
  `;
  return shell('Something Was Made For You', inner);
}


// ─── Build email by type ───
function buildEmail(type: string, data: TemplateData): { subject: string; html: string } {
  const subject = getSubject(type, data);
  let html: string;

  switch (type) {
    case 'chain_received':
      html = buildChainReceivedEmail(data);
      break;
    case '1hr_warning':
      html = (data.other_chains && data.other_chains.length > 0)
        ? build1hrWarningBatchedEmail(data)
        : build1hrWarningSingleEmail(data);
      break;
    case 'milestone':
      html = buildMilestoneEmail(data);
      break;
    case 'completed':
      html = buildCompletedEmail(data);
      break;
    case 'ment_received':
      html = buildMentReceivedEmail(data);
      break;
    default:
      throw new Error(`Unknown email type: ${type}`);
  }

  return { subject, html };
}

// ─── MAIN HANDLER ───
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[EMAIL] send-email invoked');

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('[EMAIL] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SendEmailRequest = await req.json();
    console.log('[EMAIL] type:', body.email_type, 'to:', body.recipient_email);

    const { email_type, recipient_email, recipient_id, chain_id, template_data } = body;

    if (!email_type || !recipient_email || !template_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Duplicate prevention: check if same email was sent in last 2 hours
    if (chain_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const dupClient = createClient(supabaseUrl, supabaseServiceKey);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: recentEmail } = await dupClient
        .from('email_logs')
        .select('id')
        .eq('chain_id', chain_id)
        .eq('recipient_email', recipient_email)
        .eq('email_type', email_type)
        .gte('sent_at', twoHoursAgo)
        .limit(1)
        .maybeSingle();

      if (recentEmail) {
        console.log('[EMAIL] Duplicate prevented:', email_type, recipient_email, chain_id);
        return new Response(
          JSON.stringify({ success: true, message: 'Duplicate prevented' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { subject, html } = buildEmail(email_type, template_data);
    console.log('[EMAIL] Subject:', subject);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let resendResponse;
    try {
      resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Ment Shop <info@mentshop.com>',
          to: recipient_email,
          subject,
          html,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const resendData = await resendResponse.json();
    console.log('[EMAIL] Resend:', resendResponse.status, JSON.stringify(resendData));

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Resend API error', details: resendData }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: logError } = await adminClient
      .from('email_logs')
      .insert({
        email_type,
        recipient_email,
        recipient_id: recipient_id || null,
        chain_id: chain_id || null,
        resend_id: resendData.id || null,
        status: 'sent',
        metadata: { subject, template_data },
      });

    if (logError) console.warn('[EMAIL] Log failed:', logError);

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EMAIL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
