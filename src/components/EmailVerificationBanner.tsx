import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Subtle, dismissible banner nudging users to confirm their email.
 * Non-blocking — purely for bounce hygiene. Hidden once the email is
 * confirmed, and dismissed only for the current tab session.
 */
const EmailVerificationBanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const dismissKey = user ? `email_banner_dismissed_${user.id}` : '';
  const [dismissed, setDismissed] = useState<boolean>(() =>
    dismissKey ? sessionStorage.getItem(dismissKey) === '1' : false
  );
  const [sending, setSending] = useState(false);

  if (!user) return null;

  // Supabase marks confirmation on the user object; treat any confirmation
  // timestamp as verified.
  const confirmed = Boolean(
    (user as { email_confirmed_at?: string | null }).email_confirmed_at ||
      (user as { confirmed_at?: string | null }).confirmed_at
  );
  if (confirmed || dismissed) return null;

  const handleDismiss = () => {
    if (dismissKey) sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const handleResend = async () => {
    if (!user.email || sending) return;
    setSending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
    setSending(false);
    if (error) {
      toast({ title: "Couldn't resend", description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sent!', description: 'Check your inbox for the confirmation link.' });
    }
  };

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-xs"
      style={{ backgroundColor: '#EAF7E6', color: '#166534' }}
    >
      <span className="text-center">
        Almost there! Check your inbox and tap the link so your Ments always land.
      </span>
      <button
        onClick={handleResend}
        disabled={sending}
        className="shrink-0 font-semibold underline hover:opacity-80 disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Resend'}
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 hover:bg-black/5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default EmailVerificationBanner;
