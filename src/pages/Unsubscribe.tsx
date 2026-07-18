import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import mentShopLogo from '@/assets/ment-shop-logo.png';

// Masks an email like donna@example.com -> d***a@example.com
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

type Status = 'loading' | 'success' | 'invalid';

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        if (!cancelled) setStatus('invalid');
        return;
      }
      try {
        // The page load IS the opt-out action — no extra confirmation step.
        const { data, error } = await supabase.functions.invoke('handle-unsubscribe', {
          body: { token, source: 'email_link' },
        });
        if (cancelled) return;
        if (error || !data?.success || !data?.email) {
          setStatus('invalid');
          return;
        }
        setEmail(data.email);
        setStatus('success');
      } catch {
        if (!cancelled) setStatus('invalid');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <img
          src={mentShopLogo}
          alt="The Ment Shop"
          className="h-24 w-auto object-contain mx-auto mb-8"
        />

        {status === 'loading' && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <p className="text-muted-foreground">One moment…</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <h1 className="text-2xl font-extrabold text-foreground mb-3">
              Hmm, that link looks off.
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              This link doesn't look right. If you're trying to unsubscribe, please
              contact us at{' '}
              <a
                href="mailto:hello@mentshop.com"
                className="text-primary font-semibold underline underline-offset-2"
              >
                hello@mentshop.com
              </a>
              .
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <span className="text-2xl">✓</span>
            </div>
            <h1 className="text-3xl font-extrabold text-foreground mb-3">We get it.</h1>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You've been unsubscribed. You won't receive any more Ment notification
              emails at{' '}
              <span className="font-semibold text-foreground">{maskEmail(email)}</span>.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Changed your mind? You can always sign up at The Ment Shop and send some
              kindness yourself.
            </p>
            <Button asChild size="lg" className="rounded-full font-bold">
              <Link to="/">Visit The Ment Shop</Link>
            </Button>
          </div>
        )}

        <p className="mt-8 text-xs text-muted-foreground/70">
          The Ment Shop · A chain of kindness, passed person to person.
        </p>
      </div>
    </div>
  );
};

export default Unsubscribe;
