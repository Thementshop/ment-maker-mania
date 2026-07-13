import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Users, ChevronLeft, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useContactGroups, MAX_GROUPS, MAX_MEMBERS, type GroupMember } from '@/hooks/useContactGroups';

interface GroupsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DraftMember {
  id?: string;
  contact_email: string;
  contact_name: string;
  contact_phone: string | null;
}

interface ContactRow {
  contact_name: string;
  email: string | null;
  phone: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GroupsManagerModal = ({ isOpen, onClose }: GroupsManagerModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { groups, loading, refetch, getMembers } = useContactGroups();

  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // New-member inputs
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!isOpen || !user) return;
    setView('list');
    supabase
      .from('user_contacts')
      .select('contact_name, email, phone')
      .eq('user_id', user.id)
      .then(({ data }) => setContacts((data ?? []) as ContactRow[]));
  }, [isOpen, user]);

  const suggestions = useMemo(() => {
    const q = (newName + ' ' + newEmail).toLowerCase().trim();
    if (q.length < 2) return [];
    return contacts
      .filter((c) => c.email && (
        c.contact_name.toLowerCase().includes(newName.toLowerCase().trim() || '\u0000') ||
        (c.email ?? '').toLowerCase().includes(newEmail.toLowerCase().trim() || '\u0000')
      ))
      .slice(0, 5);
  }, [contacts, newName, newEmail]);

  const startCreate = () => {
    if (groups.length >= MAX_GROUPS) {
      toast({ title: 'Group limit reached', description: `You can have up to ${MAX_GROUPS} groups.`, variant: 'destructive' });
      return;
    }
    setEditingId(null);
    setName('');
    setMembers([]);
    setNewName(''); setNewEmail('');
    setConfirmDelete(false);
    setView('edit');
  };

  const startEdit = async (groupId: string, groupName: string) => {
    setEditingId(groupId);
    setName(groupName);
    setNewName(''); setNewEmail('');
    setConfirmDelete(false);
    setView('edit');
    const existing = await getMembers(groupId);
    setMembers(existing.map((m: GroupMember) => ({
      id: m.id,
      contact_email: m.contact_email,
      contact_name: m.contact_name ?? '',
      contact_phone: m.contact_phone,
    })));
  };

  const addMember = (email: string, memberName: string, phone: string | null) => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      toast({ title: 'Enter a valid email', variant: 'destructive' });
      return;
    }
    if (members.some((m) => m.contact_email.toLowerCase() === e)) {
      toast({ title: 'Already in this group', variant: 'destructive' });
      return;
    }
    if (members.length >= MAX_MEMBERS) {
      toast({ title: 'Member limit reached', description: `Groups can have up to ${MAX_MEMBERS} members.`, variant: 'destructive' });
      return;
    }
    setMembers((prev) => [...prev, { contact_email: e, contact_name: memberName.trim(), contact_phone: phone }]);
    setNewName(''); setNewEmail('');
  };

  const removeMember = (email: string) => {
    setMembers((prev) => prev.filter((m) => m.contact_email.toLowerCase() !== email.toLowerCase()));
  };

  const saveGroup = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) { toast({ title: 'Name your group', variant: 'destructive' }); return; }
    if (trimmed.length > 50) { toast({ title: 'Name is too long', description: 'Max 50 characters.', variant: 'destructive' }); return; }
    if (members.length === 0) { toast({ title: 'Add at least one member', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      let groupId = editingId;
      if (groupId) {
        const { error } = await supabase.from('contact_groups').update({ name: trimmed }).eq('id', groupId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contact_groups')
          .insert({ user_id: user.id, name: trimmed })
          .select('id')
          .single();
        if (error) throw error;
        groupId = data.id;
      }

      // Replace members wholesale (small lists; keeps logic simple + consistent).
      await supabase.from('contact_group_members').delete().eq('group_id', groupId!);
      const rows = members.map((m) => ({
        group_id: groupId!,
        contact_email: m.contact_email.toLowerCase(),
        contact_name: m.contact_name || null,
        contact_phone: m.contact_phone || null,
      }));
      const { error: memErr } = await supabase.from('contact_group_members').insert(rows);
      if (memErr) throw memErr;

      toast({ title: editingId ? 'Group updated' : 'Group created' });
      await refetch();
      setView('list');
    } catch (err: any) {
      const msg = err?.code === '23505' ? 'You already have a group with that name.' : (err?.message || 'Please try again');
      toast({ title: "Couldn't save group", description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async () => {
    if (!editingId) return;
    setDeleting(true);
    const { error } = await supabase.from('contact_groups').delete().eq('id', editingId);
    setDeleting(false);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Group deleted' });
    await refetch();
    setView('list');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors z-10">
              <X className="h-5 w-5" />
            </button>

            {/* ─── LIST VIEW ─── */}
            {view === 'list' && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-foreground">My Groups</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Send one Ment to a whole crew at once</p>
                </div>

                {loading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : groups.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">No groups yet — create your first one!</p>
                ) : (
                  <div className="space-y-2">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => startEdit(g.id, g.name)}
                        className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground truncate">{g.name}</p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{g.member_count} member{g.member_count !== 1 ? 's' : ''}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{g.preview}</p>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={startCreate}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Create New Group
                </button>
              </div>
            )}

            {/* ─── CREATE / EDIT VIEW ─── */}
            {view === 'edit' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setView('list')} className="rounded-full p-1.5 hover:bg-muted transition-colors">
                    <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <h2 className="font-display text-xl font-bold text-foreground">{editingId ? 'Edit Group' : 'New Group'}</h2>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Group name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    placeholder="e.g. Sales Team"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">{name.length}/50</p>
                </div>

                {/* Members */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-muted-foreground">Members</label>
                    <span className="text-[10px] text-muted-foreground">{members.length}/{MAX_MEMBERS}</span>
                  </div>

                  {members.length > 0 && (
                    <div className="space-y-1.5 mb-3 max-h-44 overflow-y-auto">
                      {members.map((m) => (
                        <div key={m.contact_email} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{m.contact_name || m.contact_email.split('@')[0]}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.contact_email}</p>
                          </div>
                          <button onClick={() => removeMember(m.contact_email)} className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add member */}
                  <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Name (optional)"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <input
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Email"
                      type="email"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(newEmail, newName, null); } }}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />

                    {suggestions.length > 0 && (
                      <div className="rounded-lg border border-border overflow-hidden">
                        {suggestions.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => addMember(c.email!, c.contact_name, c.phone)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
                          >
                            <span className="font-medium text-foreground">{c.contact_name}</span>{' '}
                            <span className="text-xs text-muted-foreground">{c.email}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => addMember(newEmail, newName, null)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors"
                    >
                      <UserPlus className="h-4 w-4" /> Add member
                    </button>
                  </div>
                </div>

                <button
                  onClick={saveGroup}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Group
                </button>

                {editingId && (
                  confirmDelete ? (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                      <p className="text-sm text-foreground">
                        Delete <span className="font-semibold">{name}</span>? Your contacts won't be affected — just the group.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                        <button onClick={deleteGroup} disabled={deleting} className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-1">
                          {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 text-sm text-destructive hover:underline"
                    >
                      <Trash2 className="h-4 w-4" /> Delete Group
                    </button>
                  )
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GroupsManagerModal;
