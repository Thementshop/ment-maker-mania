import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface ComplaintRow {
  recipient_email: string;
  created_at: string;
  on_dnc: boolean;
}
interface BounceRow {
  recipient_email: string;
  created_at: string;
  bounce_count: number;
  on_dnc: boolean;
}
interface TopSender {
  email: string | null;
  sends_today: number;
  sends_week: number;
  recipients_week: number;
  account_age_days: number;
  has_reports: boolean;
}
interface HealthData {
  delivered_7d: number;
  complained_7d: number;
  bounced_7d: number;
  sent_7d: number;
  do_not_contact_count: number;
  recent_complaints: ComplaintRow[];
  recent_bounces: BounceRow[];
  top_senders: TopSender[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// pct returns a percentage number (0 when denominator is 0).
function pct(num: number, den: number): number {
  if (!den) return 0;
  return (num / den) * 100;
}

function rateColor(rate: number, warn: number, danger: number): string {
  if (rate >= danger) return 'text-red-600';
  if (rate >= warn) return 'text-yellow-600';
  return 'text-green-600';
}

const EmailHealthSection = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error: err } = await supabase.rpc('admin_get_email_health');
    if (err) {
      console.error('[EmailHealth]', err);
      setError(err.message);
    } else {
      setHealth(data as unknown as HealthData);
      setError(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Email Health</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </section>
    );
  }

  if (error || !health) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Email Health</h2>
        </div>
        <p className="text-sm text-muted-foreground">Couldn't load email health{error ? `: ${error}` : ''}.</p>
      </section>
    );
  }

  const complaintRate = pct(health.complained_7d, health.delivered_7d);
  const bounceRate = pct(health.bounced_7d, health.sent_7d);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Email Health</h2>
        <span className="text-xs text-muted-foreground">last 7 days</span>
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Complaint rate</p>
            <p className={`text-3xl font-extrabold mt-1 ${rateColor(complaintRate, 0.10, 0.30)}`}>
              {complaintRate.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {health.complained_7d} complaints / {health.delivered_7d.toLocaleString()} delivered
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bounce rate</p>
            <p className={`text-3xl font-extrabold mt-1 ${rateColor(bounceRate, 2, 5)}`}>
              {bounceRate.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {health.bounced_7d} bounced / {health.sent_7d.toLocaleString()} sent
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Do-not-contact</p>
            <p className="text-3xl font-extrabold mt-1 text-foreground">
              {health.do_not_contact_count.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">total opted-out addresses</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent complaints */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Recent complaints</h3>
          {health.recent_complaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No complaints. 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">Recipient</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 font-medium">On do-not-contact</th>
                  </tr>
                </thead>
                <tbody>
                  {health.recent_complaints.map((c, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-foreground break-all">{c.recipient_email}</td>
                      <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{formatDate(c.created_at)}</td>
                      <td className="py-2">
                        <Badge className={c.on_dnc ? 'bg-green-600 text-white' : 'bg-destructive text-destructive-foreground'}>
                          {c.on_dnc ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent bounces */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Recent bounces</h3>
          {health.recent_bounces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bounces.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">Recipient</th>
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Total bounces</th>
                    <th className="py-2 font-medium">On do-not-contact</th>
                  </tr>
                </thead>
                <tbody>
                  {health.recent_bounces.map((b, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-foreground break-all">{b.recipient_email}</td>
                      <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{formatDate(b.created_at)}</td>
                      <td className="py-2 pr-3 text-foreground">{b.bounce_count}</td>
                      <td className="py-2">
                        <Badge className={b.on_dnc ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}>
                          {b.on_dnc ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top senders */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Top senders (last 7 days)</h3>
          {health.top_senders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sending activity this week.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">User</th>
                    <th className="py-2 pr-3 font-medium">Today</th>
                    <th className="py-2 pr-3 font-medium">This week</th>
                    <th className="py-2 pr-3 font-medium">Recipients (wk)</th>
                    <th className="py-2 pr-3 font-medium">Account age</th>
                    <th className="py-2 font-medium">Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {health.top_senders.map((s, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-foreground break-all">{s.email || 'Unknown'}</td>
                      <td className="py-2 pr-3 text-foreground">{s.sends_today}</td>
                      <td className="py-2 pr-3 text-foreground">{s.sends_week}</td>
                      <td className="py-2 pr-3 text-foreground">{s.recipients_week}</td>
                      <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{s.account_age_days}d</td>
                      <td className="py-2">
                        {s.has_reports ? (
                          <Badge className="bg-destructive text-destructive-foreground">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default EmailHealthSection;
