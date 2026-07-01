import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flag, Loader2, ShieldCheck } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useGameStore } from '@/store/gameStore';
import { supabase } from '@/integrations/supabase/client';

interface ReportRow {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  reported_ment_id: string | null;
  compliment_text: string | null;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Under review', className: 'bg-yellow-400/90 text-yellow-950' },
  reviewed: { label: 'Reviewed', className: 'bg-primary text-primary-foreground' },
  resolved: { label: 'Resolved', className: 'bg-primary text-primary-foreground' },
  dismissed: { label: 'Closed', className: 'bg-muted text-muted-foreground' },
};

function statusMeta(status: string) {
  return STATUS_STYLES[status?.toLowerCase()] ?? {
    label: status || 'Submitted',
    className: 'bg-secondary text-secondary-foreground',
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const ReportHistory = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { worldKindnessCount } = useGameStore();

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadReports = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(false);
    const { data, error: rpcError } = await supabase.rpc('get_my_reports');
    if (rpcError) {
      console.error('[ReportHistory] failed to load reports:', rpcError);
      setError(true);
    } else {
      setReports((data as ReportRow[]) ?? []);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    loadReports();
  }, [authLoading, user, navigate, loadReports]);

  return (
    <div className="min-h-screen bg-gradient-mint flex flex-col">
      <Header worldCount={worldKindnessCount} />

      <main className="container flex-1 py-8 px-4 max-w-2xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Flag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Your reports</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Every report you send helps keep The Ment Shop kind. Here's what you've flagged and where each one stands.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="border-border">
            <CardContent className="py-10 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                We couldn't load your reports right now. Please try again in a moment.
              </p>
              <Button variant="outline" onClick={loadReports}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : reports.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-12 text-center space-y-3">
              <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
              <h2 className="text-lg font-semibold text-foreground">No reports yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                If a Ment ever doesn't feel like kindness, you can report it and we'll take a look.
                Anything you flag will show up here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((report, idx) => {
              const meta = statusMeta(report.status);
              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card className="border-border">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className="text-xs text-muted-foreground">
                          Reported {formatDate(report.created_at)}
                        </span>
                        <Badge className={meta.className}>{meta.label}</Badge>
                      </div>

                      <p className="text-sm text-foreground">
                        {report.compliment_text ? (
                          <span className="italic">"{report.compliment_text}"</span>
                        ) : (
                          <span className="text-muted-foreground">
                            This Ment is no longer available.
                          </span>
                        )}
                      </p>

                      {report.reason && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">Your note:</span> {report.reason}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Back
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ReportHistory;
