import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const MAX_GROUPS = 20;
export const MAX_MEMBERS = 50;

export interface GroupMember {
  id: string;
  group_id: string;
  contact_email: string;
  contact_name: string | null;
  contact_phone: string | null;
}

export interface GroupSummary {
  id: string;
  name: string;
  member_count: number;
  preview: string;
}

function firstName(m: GroupMember): string {
  const n = (m.contact_name || '').trim();
  if (n) return n.split(' ')[0];
  return (m.contact_email || '').split('@')[0];
}

function buildPreview(members: GroupMember[]): string {
  if (members.length === 0) return 'No members yet';
  const names = members.slice(0, 2).map(firstName);
  const remaining = members.length - names.length;
  if (remaining <= 0) return names.join(' and ');
  return `${names.join(', ')}, and ${remaining} other${remaining > 1 ? 's' : ''}`;
}

export function useContactGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: groupRows } = await supabase
      .from('contact_groups')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const ids = (groupRows ?? []).map((g) => g.id);
    let membersByGroup: Record<string, GroupMember[]> = {};
    if (ids.length > 0) {
      const { data: memberRows } = await supabase
        .from('contact_group_members')
        .select('id, group_id, contact_email, contact_name, contact_phone')
        .in('group_id', ids);
      for (const m of (memberRows ?? []) as GroupMember[]) {
        (membersByGroup[m.group_id] ??= []).push(m);
      }
    }

    setGroups(
      (groupRows ?? []).map((g) => {
        const members = membersByGroup[g.id] ?? [];
        return { id: g.id, name: g.name, member_count: members.length, preview: buildPreview(members) };
      }),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => { void refetch(); }, [refetch]);

  const getMembers = useCallback(async (groupId: string): Promise<GroupMember[]> => {
    const { data } = await supabase
      .from('contact_group_members')
      .select('id, group_id, contact_email, contact_name, contact_phone')
      .eq('group_id', groupId)
      .order('added_at', { ascending: true });
    return (data ?? []) as GroupMember[];
  }, []);

  return { groups, loading, refetch, getMembers };
}
