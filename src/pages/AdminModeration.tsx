import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, Loader2, ShieldAlert, Ban, ScrollText, UserX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminUserId } from '@/config/admins';
import { supabase } from '@/integrations/supabase/client';

interface ReportRow {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  reported_ment_id: string | null;
  compliment_text: string | null;
  sender_id: string | null;
  sender_name: string | null;
  sender_email: string | null;
  sender_banned: boolean;
  reporter_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
}

interface BlockRow {
  id: string;
  blocked_text: string;
  trigger_term: string;
  match_type: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
}

interface BannedRow {
  id: string;
  display_name: string | null;
  email: string | null;
  banned_at: string | null;
  report_count: number;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Under review', className: 'bg-yellow-400/90 text-yellow-950' },
  reviewed: { label: 'Reviewed', className: 'bg-blue-500 text-white' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground' },
  actioned: { label: 'Actioned (banned)', className: 'bg-destructive text-destructive-foreground' },
};

function statusMeta(status: string) {
  return STATUS_STYLES[status?.toLowerCase()] ?? {
    label: status || 'Submitted',
    className: 'bg-secondary text-secondary-foreground',
  };
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAGE_SIZE = 50;

const AdminModeration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [banned, setBanned] = useState<BannedRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [blockOffset, setBlockOffset] = useState(0);
  const [hasMoreBlocks, setHasMoreBlocks] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = isAdminUserId(user?.id);

  const loadReports = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_reports');
    if (error) console.error('[AdminModeration] reports:', error);
    else setReports((data as ReportRow[]) ?? []);
  }, []);

  const loadBanned = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_banned_users');
    if (error) console.error('[AdminModeration] banned:', error);
    else setBanned((data as BannedRow[]) ?? []);
  }, []);

  const loadBlocks = useCallback(async (offset: number) => {
    const { data, error } = await supabase.rpc('admin_get_content_blocks', {
      _limit: PAGE_SIZE,
      _offset: offset,
    });
    if (error) {
      console.error('[AdminModeration] blocks:', error);
      return;
    }
    const rows = (data as BlockRow[]) ?? [];
    setBlocks((prev) => (offset === 0 ? rows : [...prev, ...rows]));
    setHasMoreBlocks(rows.length === PAGE_SIZE);
    setBlockOffset(offset + rows.length);
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadReports(), loadBanned(), loadBlocks(0)]);
    setIsLoading(false);
  }, [loadReports, loadBanned, loadBlocks]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    if (!isAdmin) {
      navigate('/', { replace: true });
      return;
    }
    loadAll();
  }, [authLoading, user, isAdmin, navigate, loadAll]);

  const setStatus = async (reportId: string, status: string) => {
    setBusyId(reportId);
    const { error } = await supabase.rpc('admin_set_report_status', {
      _report_id: reportId,
      _status: status,
    });
    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
    } else {
      await loadReports();
    }
    setBusyId(null);
  };

  const banSender = async (report: ReportRow) => {
    if (!report.sender_id) {
      toast({ title: 'No sender on this report', variant: 'destructive' });
      return;
    }
    setBusyId(report.id);
    const { error } = await supabase.rpc('admin_ban_user', {
      _user_id: report.sender_id,
      _report_id: report.id,
    });
    if (error) {
      toast({ title: 'Could not ban', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sender banned', description: 'Their sends now silently fail.' });
      await Promise.all([loadReports(), loadBanned()]);
    }
    setBusyId(null);
  };

  const unbanUser = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.rpc('admin_unban_user', { _user_id: userId });
    if (error) {
      toast({ title: 'Could not unban', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'User unbanned' });
      await Promise.all([loadReports(), loadBanned()]);
    }
    setBusyId(null);
  };

  if (authLoading || (isLoading && isAdmin)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4 space-y-10">
        <header className="space-y-1">
          <div className="inline-flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Moderation dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">Admin only — not linked anywhere in the app.</p>
        </header>

        {/* ── Section 1: Reported Ments ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Reported Ments</h2>
            <Badge variant="secondary">{reports.length}</Badge>
          </div>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => {
                const meta = statusMeta(r.status);
                const busy = busyId === r.id;
                return (
                  <Card key={r.id} className="border-border">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                        <Badge className={meta.className}>{meta.label}</Badge>
                      </div>

                      <p className="text-sm text-foreground">
                        {r.compliment_text ? (
                          <span className="italic">"{r.compliment_text}"</span>
                        ) : (
                          <span className="text-muted-foreground">This Ment is no longer available.</span>
                        )}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Sender:</span>{' '}
                          {r.sender_name || 'Unknown'}{r.sender_email ? ` (${r.sender_email})` : ''}
                          {r.sender_banned && (
                            <Badge className="ml-2 bg-destructive text-destructive-foreground">Banned</Badge>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Reporter:</span>{' '}
                          {r.reporter_name || 'Unknown'}{r.reporter_email ? ` (${r.reporter_email})` : ''}
                        </div>
                      </div>

                      {r.reason && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Reporter note:</span> {r.reason}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(r.id, 'reviewed')}>
                          Mark Reviewed
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(r.id, 'closed')}>
                          Close
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy || r.sender_banned || !r.sender_id}
                          onClick={() => banSender(r)}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          {r.sender_banned ? 'Banned' : 'Ban Sender'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Section 2: Content Filter Log ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Content filter log</h2>
            <Badge variant="secondary">{blocks.length}</Badge>
          </div>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked attempts logged.</p>
          ) : (
            <div className="space-y-2">
              {blocks.map((b) => (
                <Card key={b.id} className="border-border">
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{formatDateTime(b.created_at)}</span>
                      <Badge variant="outline" className="uppercase text-[10px]">{b.match_type}</Badge>
                    </div>
                    <p className="text-sm text-foreground italic">"{b.blocked_text}"</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Trigger:</span> {b.trigger_term || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">User:</span>{' '}
                      {b.user_name || 'Unknown'}{b.user_email ? ` (${b.user_email})` : ''}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {hasMoreBlocks && (
                <div className="text-center pt-2">
                  <Button variant="outline" size="sm" onClick={() => loadBlocks(blockOffset)}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Section 3: Blocked Users ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Banned users</h2>
            <Badge variant="secondary">{banned.length}</Badge>
          </div>
          {banned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No banned users.</p>
          ) : (
            <div className="space-y-2">
              {banned.map((u) => {
                const busy = busyId === u.id;
                return (
                  <Card key={u.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <p className="font-medium text-foreground">{u.display_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{u.email || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          Banned {formatDateTime(u.banned_at)} · {u.report_count} report(s)
                        </p>
                      </div>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => unbanUser(u.id)}>
                        Unban
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminModeration;
