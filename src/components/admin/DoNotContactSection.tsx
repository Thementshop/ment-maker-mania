import { useEffect, useState } from 'react';
import { MailX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface DncRow {
  email: string;
  opted_out_at: string;
  source: string;
}

// Partially masks an email for admin display: jane@gmail.com → j••e@gmail.com
function maskEmail(email: string): string {
  const [local, domain] = (email || '').split('@');
  if (!domain) return email || '—';
  let maskedLocal: string;
  if (local.length <= 2) {
    maskedLocal = local.charAt(0) + '•';
  } else {
    maskedLocal = `${local.charAt(0)}${'•'.repeat(Math.min(local.length - 2, 4))}${local.charAt(local.length - 1)}`;
  }
  return `${maskedLocal}@${domain}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const SOURCE_LABELS: Record<string, string> = {
  email_header: 'One-click (email)',
  unsubscribe_page: 'Unsubscribe page',
  complaint: 'Spam complaint',
  bounce: 'Repeated bounce',
};

const DoNotContactSection = () => {
  const [rows, setRows] = useState<DncRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('admin_get_do_not_contact');
      if (error) console.error('[AdminModeration] do_not_contact:', error);
      else setRows((data as DncRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <MailX className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Unsubscribed (do-not-contact)</h2>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Recipients who permanently opted out of Ment emails. Read-only. Addresses are partially masked.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one has unsubscribed yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Opted out</th>
                <th className="px-4 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.email}-${i}`} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 font-mono text-foreground">{maskEmail(r.email)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDateTime(r.opted_out_at)}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {SOURCE_LABELS[r.source] ?? r.source ?? '—'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default DoNotContactSection;
