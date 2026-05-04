import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send } from 'lucide-react';
import { complimentCategories } from '@/data/compliments';
import { supabase } from '@/integrations/supabase/client';

interface CustomComplimentInputProps {
  onSelect: (text: string) => void;
}

const ALL_COMPLIMENTS = complimentCategories.flatMap(c =>
  c.compliments.map(text => ({ text, categoryName: c.name, emoji: c.emoji }))
);

const CustomComplimentInput = ({ onSelect }: CustomComplimentInputProps) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [popular, setPopular] = useState<string[]>([]);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);

  useEffect(() => {
    // Load popular compliments + blocked words list once
    (async () => {
      const [popRes, blockedRes] = await Promise.all([
        supabase.rpc('get_popular_compliments', { _limit: 5 }),
        supabase.from('blocked_words').select('word'),
      ]);
      if (popRes.data) setPopular(popRes.data.map((r: any) => r.compliment_text));
      if (blockedRes.data) setBlockedWords(blockedRes.data.map((r: any) => r.word.toLowerCase()));
    })();
  }, []);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    return ALL_COMPLIMENTS.filter(c => c.text.toLowerCase().includes(q)).slice(0, 6);
  }, [value]);

  const containsBlocked = (text: string): string | null => {
    const normalized = ' ' + text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
    for (const w of blockedWords) {
      if (normalized.includes(' ' + w + ' ')) return w;
    }
    return null;
  };

  const handleSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setChecking(true);
    // Client-side check first
    if (containsBlocked(trimmed)) {
      setError("Let's keep it kind! 💚 Try rephrasing your compliment to spread positivity.");
      setChecking(false);
      return;
    }
    // Server-side check (authoritative) — race against a 5s timeout so the UI
    // never hangs. If the check doesn't resolve in time, we fall back to the
    // client-side result (already passed) and let the message through.
    try {
      const serverCheck = supabase.rpc('contains_blocked_word', { _text: trimmed });
      const timeout = new Promise<{ data: false; error: null }>((resolve) =>
        setTimeout(() => resolve({ data: false, error: null }), 5000)
      );
      const result = (await Promise.race([serverCheck, timeout])) as
        | { data: boolean | null; error: unknown };
      setChecking(false);
      if (result?.data === true) {
        setError("Let's keep it kind! 💚 Try rephrasing your compliment to spread positivity.");
        return;
      }
      onSelect(trimmed);
    } catch {
      setChecking(false);
      // Network/transient error — don't block the user, accept the message.
      onSelect(trimmed);
    }
  };

  return (
    <div className="space-y-3">
      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">— or write your own —</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Input + Send button */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(value); }}
            placeholder="Start typing your compliment..."
            maxLength={280}
            className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => handleSubmit(value)}
            disabled={!value.trim() || checking}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {value.trim() && !error && (
          <button
            onClick={() => handleSubmit(value)}
            disabled={checking}
            className="w-full rounded-xl border-2 border-primary bg-primary/5 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {checking ? 'Checking...' : `Send this: "${value.trim().slice(0, 40)}${value.trim().length > 40 ? '…' : ''}"`}
          </button>
        )}
      </div>

      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Matching ments</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {suggestions.map((s, i) => (
              <motion.button
                key={i}
                onClick={() => onSelect(s.text)}
                className="w-full rounded-lg border border-border bg-card p-2 text-left text-xs hover:border-primary hover:bg-primary/5"
                whileHover={{ scale: 1.01 }}
              >
                <span className="mr-1">{s.emoji}</span>
                {s.text}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Popular right now */}
      {popular.length > 0 && value.trim().length < 2 && (
        <div className="space-y-1 pt-1">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Popular right now
          </p>
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {popular.map((p, i) => (
              <motion.button
                key={i}
                onClick={() => onSelect(p)}
                className="w-full rounded-lg border border-border bg-card p-2 text-left text-xs hover:border-primary hover:bg-primary/5"
                whileHover={{ scale: 1.01 }}
              >
                {p}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomComplimentInput;
