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

// ─── Category-based subjects ───
const categorySubjects: Record<string, string> = {
  love: "❤️ Someone loves you!",
  encouragement: "💪 Someone believes in you!",
  sympathy: "💙 Someone is thinking of you",
  'special-occasions': "🎉 Someone's celebrating you!",
  'funny-slang': "😄 Someone made you smile!",
  affirmation: "✨ Someone sees your light!",
  default: "💚 Someone sent you a compliment!",
};

function getSubject(emailType: string, data: TemplateData): string {
  switch (emailType) {
    case 'chain_received':
      return categorySubjects[data.compliment_category || 'default'] || categorySubjects.default;
    case 'ment_received':
      return categorySubjects[data.compliment_category || 'default'] || "💚 Someone sent you a compliment!";
    case '1hr_warning':
      if (data.other_chains && data.other_chains.length > 0) {
        return `⏰ You have ${(data.other_chains.length + 1)} chains expiring soon!`;
      }
      return "⏰ Quick reminder – Chain timer running!";
    case 'milestone':
      return `🎉 Your "${escapeHtml(data.chain_name)}" chain hit ${data.milestone} shares!`;
    case 'completed':
      return `Your "${escapeHtml(data.chain_name)}" chain completed! 💚`;
    default:
      return "💚 You received a kindness chain!";
  }
}

// ─── FOOTER ───
const footer = `
<tr><td style="background-color:#f9fafb;padding:20px 30px;text-align:center;">
  <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:0 0 8px;">
    💡 Tip: Add info@mentshop.com to your contacts so our emails always reach your inbox!
  </p>
  <p style="color:#9ca3af;font-size:12px;margin:0;">
    Ment Shop – Spreading Kindness, One Compliment at a Time<br>
    Questions? Email <a href="mailto:info@mentshop.com" style="color:#58fc59;">info@mentshop.com</a>
  </p>
</td></tr>`;

// ─── TEMPLATE 1: Chain Received (Teaser) ───
function buildChainReceivedEmail(data: TemplateData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background-color:#58fc59;padding:30px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">💚 Ment Shop</h1>
    <p style="color:#dcfce7;margin:8px 0 0;font-size:14px;">Spreading Kindness, One Compliment at a Time</p>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#166534;margin:0 0 20px;font-size:22px;">Hey ${escapeHtml(data.recipient_name)}! 💚</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Someone just sent you a kindness compliment in the "${escapeHtml(data.chain_name)}" chain!
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <div style="display:inline-block;background-color:#f0fdf4;border-radius:12px;padding:24px 32px;">
        <p style="font-size:40px;margin:0;">🎁</p>
        <p style="color:#166534;font-size:18px;font-weight:bold;margin:8px 0 0;">Your compliment is waiting...</p>
      </div>
    </div>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${escapeHtml(data.chain_url)}" style="display:inline-block;background-color:#58fc59;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
        Reveal Your Compliment →
      </a>
    </div>
    <div style="background-color:#fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 24px;text-align:center;">
      <p style="color:#92400e;font-size:14px;margin:0;">⏰ You have <strong>24 hours</strong> to pass it forward!</p>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
      <p style="color:#6b7280;font-size:14px;font-weight:bold;margin:0 0 4px;">What is Ment Shop?</p>
      <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0;">
        It's a game where kindness spreads from person to person. Join the chain! 🔗
      </p>
    </div>
  </td></tr>
  ${footer}
</table>
</td></tr></table></body></html>`;
}

// ─── TEMPLATE 2a: 1hr Warning (Single) ───
function build1hrWarningSingleEmail(data: TemplateData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background-color:#f59e0b;padding:30px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">⏰ Time's Running Out!</h1>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#92400e;margin:0 0 20px;font-size:22px;">Hey ${escapeHtml(data.recipient_name)}! 👋</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
      Just a friendly heads up – you've got <strong>1 hour left</strong> to pass your "${escapeHtml(data.chain_name)}" chain forward!
    </p>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
      Don't let the kindness stop here! 🔗
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${escapeHtml(data.chain_url)}" style="display:inline-block;background-color:#f59e0b;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
        Pass It Forward →
      </a>
    </div>
    <div style="background-color:#f0fdf4;border-radius:8px;padding:12px 16px;text-align:center;">
      <p style="color:#166534;font-size:13px;margin:0;">⏸️ Need more time? Use a pause token to reset your 24-hour timer!</p>
    </div>
  </td></tr>
  ${footer}
</table>
</td></tr></table></body></html>`;
}

// ─── TEMPLATE 2b: 1hr Warning (Batched) ───
function build1hrWarningBatchedEmail(data: TemplateData): string {
  const otherChainsHtml = (data.other_chains || []).map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e5e7eb;">
      <p style="color:#374151;font-size:14px;margin:0;">🔗 "${escapeHtml(c.chain_name)}"</p>
      <p style="color:#92400e;font-size:13px;margin:0;">⏰ ${escapeHtml(c.time_left)} left</p>
    </div>
  `).join('');

  const appUrl = data.app_url || 'https://ment-maker-mania.lovable.app';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background-color:#f59e0b;padding:30px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">⏰ Multiple Chains Need You!</h1>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#92400e;margin:0 0 20px;font-size:22px;">Hey ${escapeHtml(data.recipient_name)}! ⏰</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      You've got a few chains that need attention:
    </p>
    <div style="background-color:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:20px;margin:0 0 16px;">
      <p style="color:#dc2626;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">⚡ MOST URGENT</p>
      <p style="color:#374151;font-size:16px;font-weight:bold;margin:0 0 4px;">🔗 "${escapeHtml(data.urgent_chain_name || data.chain_name)}"</p>
      <p style="color:#92400e;font-size:14px;margin:0 0 12px;">⏰ ${escapeHtml(data.urgent_time_left || '< 1 hour')} left</p>
      <a href="${escapeHtml(data.urgent_chain_url || data.chain_url)}" style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:bold;">
        Pass This Chain →
      </a>
    </div>
    <div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:0 0 20px;">
      <p style="color:#92400e;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">⚠️ ALSO EXPIRING SOON</p>
      ${otherChainsHtml}
    </div>
    <div style="text-align:center;margin:0 0 20px;">
      <a href="${escapeHtml(appUrl)}" style="display:inline-block;background-color:#58fc59;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
        View All Your Chains →
      </a>
    </div>
    <p style="color:#374151;font-size:16px;text-align:center;margin:0;">Don't let the kindness stop! 💚</p>
  </td></tr>
  ${footer}
</table>
</td></tr></table></body></html>`;
}

// ─── TEMPLATE 3: Milestone ───
function buildMilestoneEmail(data: TemplateData): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background:linear-gradient(135deg,#8b5cf6,#6366f1);padding:30px;text-align:center;">
    <p style="font-size:48px;margin:0;">🎉</p>
    <h1 style="color:#ffffff;margin:8px 0 0;font-size:28px;">MILESTONE REACHED!</h1>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#5b21b6;margin:0 0 20px;font-size:22px;">WOW, ${escapeHtml(data.recipient_name)}! 🌟</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
      Your "${escapeHtml(data.chain_name)}" chain just reached <strong>${data.milestone}</strong> people! That's ${data.milestone} smiles because <strong>YOU</strong> started it!
    </p>
    <div style="background-color:#f5f3ff;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
      <p style="color:#5b21b6;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">🏆 CHAIN STATS</p>
      <p style="color:#5b21b6;font-size:36px;font-weight:bold;margin:0;">${data.total_shares || data.milestone}</p>
      <p style="color:#6b7280;font-size:14px;margin:4px 0 12px;">shares (and counting!)</p>
      <p style="color:#7c3aed;font-size:14px;margin:0;">🔥 Currently "${escapeHtml(data.tier_status || 'Growing')}" status</p>
    </div>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${escapeHtml(data.chain_url)}" style="display:inline-block;background-color:#8b5cf6;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;margin:0 4px;">
        View Chain History →
      </a>
      ${data.share_url ? `<a href="${escapeHtml(data.share_url)}" style="display:inline-block;background-color:#58fc59;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;margin:0 4px;">
        Share This Achievement →
      </a>` : ''}
    </div>
    <p style="color:#374151;font-size:16px;text-align:center;margin:0 0 16px;">Keep spreading kindness! 💪</p>
    <p style="color:#9ca3af;font-size:12px;text-align:center;font-style:italic;margin:0;">
      P.S. Screenshot this and share it!<br>#MentShop #KindnessChain
    </p>
  </td></tr>
  ${footer}
</table>
</td></tr></table></body></html>`;
}

// ─── TEMPLATE 4: Chain Completed ───
function buildCompletedEmail(data: TemplateData): string {
  const complimentsHtml = (data.compliments || []).map(c => `
    <div style="background-color:#f0fdf4;border-radius:8px;padding:12px 16px;margin:0 0 8px;">
      <p style="color:#166534;font-size:15px;font-style:italic;margin:0;">"${escapeHtml(c.text)}"</p>
      <p style="color:#6b7280;font-size:12px;margin:4px 0 0;">— @${escapeHtml(c.sender_name)}</p>
    </div>
  `).join('');

  const appUrl = data.app_url || 'https://ment-maker-mania.lovable.app';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background-color:#58fc59;padding:30px;text-align:center;">
    <p style="font-size:48px;margin:0;">💚</p>
    <h1 style="color:#ffffff;margin:8px 0 0;font-size:28px;">Chain Complete!</h1>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#166534;margin:0 0 20px;font-size:22px;">Hey ${escapeHtml(data.recipient_name)}! 👋</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
      Your "${escapeHtml(data.chain_name)}" chain has ended, but look at all the kindness you started!
    </p>
    ${complimentsHtml ? `
    <div style="margin:0 0 24px;">
      <p style="color:#166534;font-size:14px;font-weight:bold;text-align:center;margin:0 0 12px;">🎊 YOUR CHAIN'S COMPLIMENTS 🎊</p>
      ${complimentsHtml}
    </div>` : ''}
    <div style="background-color:#f0fdf4;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
      <p style="color:#166534;font-size:16px;margin:0 0 4px;">
        The chain reached <strong>${data.total_shares || 0}</strong> wonderful people before completing.
      </p>
      <p style="color:#166534;font-size:16px;margin:0;">
        That's ${data.total_shares || 0} smiles because of <strong>YOU</strong>! 🌟
      </p>
    </div>
    <div style="text-align:center;">
      <a href="${escapeHtml(appUrl)}" style="display:inline-block;background-color:#58fc59;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
        Start Another Chain →
      </a>
    </div>
  </td></tr>
  ${footer}
</table>
</td></tr></table></body></html>`;
}

// ─── TEMPLATE 5: Ment Received (Single Compliment, No Chain) ───
function buildMentReceivedEmail(data: TemplateData): string {
  const appUrl = data.app_url || 'https://ment-maker-mania.lovable.app';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <tr><td style="background-color:#58fc59;padding:30px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">💚 Ment Shop</h1>
    <p style="color:#dcfce7;margin:8px 0 0;font-size:14px;">Spreading Kindness, One Compliment at a Time</p>
  </td></tr>
  <tr><td style="padding:40px 30px;">
    <h2 style="color:#166534;margin:0 0 20px;font-size:22px;">Hey ${escapeHtml(data.recipient_name)}! 💚</h2>
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 20px;">
      Someone sent you a compliment!
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <div style="display:inline-block;background-color:#f0fdf4;border-radius:12px;padding:24px 32px;">
        <p style="font-size:40px;margin:0;">🎁</p>
        <p style="color:#166534;font-size:18px;font-weight:bold;margin:8px 0 0;">Your compliment is waiting...</p>
      </div>
    </div>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${escapeHtml(appUrl)}/ment/${data.ment_id || ''}" style="display:inline-block;background-color:#58fc59;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
        See Your Compliment →
      </a>
    </div>
    <div style="background-color:#f0fdf4;border-radius:8px;padding:12px 16px;margin:0 0 24px;text-align:center;">
      <p style="color:#166534;font-size:14px;margin:0;">💚 No timer, no pressure – just a little kindness to brighten your day!</p>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:20px;text-align:center;">
      <p style="color:#6b7280;font-size:14px;font-weight:bold;margin:0 0 8px;">Want to spread the kindness?</p>
      <a href="${escapeHtml(appUrl)}" style="color:#58fc59;font-size:14px;font-weight:bold;text-decoration:none;">
        Send a compliment or start a chain →
      </a>
    </div>
  </td></tr>
  ${footer}
</table>
</td></tr></table></body></html>`;
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
