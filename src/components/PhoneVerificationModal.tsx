import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Loader2, CheckCircle2, ChevronsUpDown, Check } from 'lucide-react';
import { getFreshAccessToken } from '@/utils/freshToken';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { COUNTRIES, flagEmoji, dialPrefix, type Country } from '@/data/countries';
import { cn } from '@/lib/utils';

interface PhoneVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called once verification succeeds (after the brief success screen). */
  onVerified: () => void;
}

type Screen = 'phone' | 'code' | 'success';

const RESEND_COOLDOWN = 30;

const PhoneVerificationModal = ({ isOpen, onClose, onVerified }: PhoneVerificationModalProps) => {
  const [screen, setScreen] = useState<Screen>('phone');
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [localNumber, setLocalNumber] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const fullNumber = `${dialPrefix(country.dial)}${localNumber.replace(/[\s\-().]/g, '')}`;
  const last4 = localNumber.replace(/\D/g, '').slice(-4);

  const reset = useCallback(() => {
    setScreen('phone');
    setCountry(COUNTRIES[0]);
    setCountryOpen(false);
    setLocalNumber('');
    setDigits(['', '', '', '', '', '']);
    setLoading(false);
    setError(null);
    setCooldown(0);
  }, []);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const callFn = async (path: string, payload: Record<string, unknown>) => {
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      return { ok: false, body: { message: 'Please sign in again.' } as Record<string, unknown> };
    }
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    return { ok: resp.ok, body: body as Record<string, unknown> };
  };

  const sendCode = async () => {
    setError(null);
    if (!localNumber.replace(/\D/g, '')) {
      setError('Please enter your phone number.');
      return;
    }
    setLoading(true);
    try {
      const { ok, body } = await callFn('send-phone-code', { phone_number: fullNumber });
      setLoading(false);
      if (!ok) {
        setError((body.message as string) || 'Something went sideways on our end. Give it another shot in a minute.');
        return;
      }
      setScreen('code');
      setDigits(['', '', '', '', '', '']);
      setCooldown(RESEND_COOLDOWN);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch {
      setLoading(false);
      setError('Something went sideways on our end. Give it another shot in a minute.');
    }
  };

  const resendCode = async () => {
    if (cooldown > 0 || loading) return;
    await sendCode();
  };

  const verifyCode = async () => {
    const code = digits.join('');
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const { ok, body } = await callFn('check-phone-code', { phone_number: fullNumber, code });
      setLoading(false);
      if (!ok) {
        setError((body.message as string) || "Hmm, that code didn't match. Double-check and try again.");
        setDigits(['', '', '', '', '', '']);
        setTimeout(() => codeRefs.current[0]?.focus(), 50);
        return;
      }
      setScreen('success');
      setTimeout(() => {
        onVerified();
      }, 2000);
    } catch {
      setLoading(false);
      setError('Something went sideways on our end. Give it another shot in a minute.');
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, '');
    if (!v) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    const next = [...digits];
    // Support paste of full code.
    if (v.length > 1) {
      const chars = v.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) next[i] = chars[i] ?? next[i] ?? '';
      setDigits(next);
      const lastFilled = Math.min(chars.length, 6) - 1;
      codeRefs.current[Math.min(lastFilled + 1, 5)]?.focus();
      return;
    }
    next[index] = v;
    setDigits(next);
    if (index < 5) codeRefs.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const codeComplete = digits.join('').length === 6;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        <motion.div
          className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl"
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
        >
          {screen !== 'success' && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Screen 1: Enter phone number */}
          {screen === 'phone' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-7 w-7 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  One quick thing before your first Ment flies!
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Verify your number so we know you're a real person spreading real kindness.
                </p>
              </div>

              <div className="flex gap-2">
                <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={countryOpen}
                      aria-label="Select country code"
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-border bg-background px-3 py-3 text-sm font-medium focus:border-primary focus:outline-none"
                    >
                      <span className="text-base leading-none">{flagEmoji(country.iso2)}</span>
                      <span>{country.dial}</span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command
                      filter={(value, search) =>
                        value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                      }
                    >
                      <CommandInput placeholder="Search country..." />
                      <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        {COUNTRIES.map((c, i) => (
                          <CommandItem
                            key={`${c.iso2}-${c.name}-${i}`}
                            value={`${c.name} ${c.dial}`}
                            onSelect={() => {
                              setCountry(c);
                              setCountryOpen(false);
                            }}
                          >
                            <span className="mr-2 text-base leading-none">{flagEmoji(c.iso2)}</span>
                            <span className="flex-1">{c.name}</span>
                            <span className="text-muted-foreground">{c.dial}</span>
                            <Check
                              className={cn(
                                'ml-2 h-4 w-4',
                                country.name === c.name && country.dial === c.dial
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <input
                  type="tel"
                  inputMode="tel"
                  autoFocus
                  value={localNumber}
                  onChange={(e) => setLocalNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void sendCode(); }}
                  placeholder="(555) 123-4567"
                  className="flex-1 rounded-xl border-2 border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                onClick={() => void sendCode()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send me a code'}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                We'll text you a 6-digit code. Standard message rates apply.
              </p>
            </div>
          )}

          {/* Screen 2: Enter code */}
          {screen === 'code' && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-7 w-7 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">Check your texts!</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter the 6-digit code we just sent to{' '}
                  <span className="font-semibold text-foreground">***-***-{last4 || '****'}</span>.
                </p>
              </div>

              <div className="flex justify-center gap-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (codeRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    className="h-14 w-11 rounded-xl border-2 border-border bg-background text-center text-2xl font-bold focus:border-primary focus:outline-none"
                  />
                ))}
              </div>

              {error && <p className="text-center text-sm text-destructive">{error}</p>}

              <button
                onClick={() => void verifyCode()}
                disabled={!codeComplete || loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify'}
              </button>

              <div className="flex flex-col items-center gap-2 text-sm">
                {cooldown > 0 ? (
                  <span className="text-muted-foreground">Didn't get it? Resend in {cooldown}s</span>
                ) : (
                  <button
                    onClick={() => void resendCode()}
                    disabled={loading}
                    className="font-semibold text-primary hover:underline"
                  >
                    Didn't get it? Resend code
                  </button>
                )}
                <button
                  onClick={() => { setScreen('phone'); setError(null); }}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  Use a different number
                </button>
              </div>
            </div>
          )}

          {/* Screen 3: Success */}
          {screen === 'success' && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                <CheckCircle2 className="h-16 w-16 text-primary" />
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-foreground">You're in!</h2>
              <p className="text-sm text-muted-foreground">Now go make someone's day.</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PhoneVerificationModal;
