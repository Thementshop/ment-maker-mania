import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Phone, Mail, Clock, ChevronDown } from 'lucide-react';

export interface UserContact {
  id: string;
  contact_name: string;
  phone: string | null;
  email: string | null;
  delivery_preference: string;
  total_ments_sent: number;
  last_sent_at: string | null;
}

interface ContactSelectorProps {
  onContactSelected: (contact: UserContact) => void;
  onNewContact: () => void;
  initialSearch?: string;
}

const ContactSelector = ({ onContactSelected, onNewContact, initialSearch = '' }: ContactSelectorProps) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [filtered, setFiltered] = useState<UserContact[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('user_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('last_sent_at', { ascending: false, nullsFirst: false });
      if (data) setContacts(data as UserContact[]);
      setLoading(false);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setFiltered([]);
      return;
    }
    const lower = search.toLowerCase();
    setFiltered(
      contacts.filter(c =>
        c.contact_name.toLowerCase().includes(lower) ||
        c.phone?.includes(search) ||
        c.email?.toLowerCase().includes(lower)
      ).slice(0, 8)
    );
  }, [search, contacts]);

  const recentContacts = contacts.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
          <Search className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground">Who's getting a ment?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Search your contacts or add someone new</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type a name to search..."
          className="pl-10"
        />
      </div>

      {/* Autocomplete results */}
      <AnimatePresence>
        {search.length >= 2 && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="border border-border rounded-xl overflow-hidden bg-card"
          >
            {filtered.map((c) => (
              <ContactRow key={c.id} contact={c} onClick={() => onContactSelected(c)} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* No results - offer to add */}
      {search.length >= 2 && filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-3">
          <p className="text-sm text-muted-foreground mb-2">No contacts match "{search}"</p>
          <button
            onClick={onNewContact}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Add New Contact
          </button>
        </motion.div>
      )}

      {/* Recent contacts (when not searching) */}
      {search.length < 2 && !loading && contacts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Clock className="inline h-3 w-3 mr-1" />Recent
          </p>
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            {recentContacts.map((c) => (
              <ContactRow key={c.id} contact={c} onClick={() => onContactSelected(c)} />
            ))}
          </div>
        </div>
      )}

      {/* Browse all */}
      {search.length < 2 && contacts.length > 5 && (
        <div>
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full flex items-center justify-center gap-1 text-sm text-primary font-medium py-2 hover:underline"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
            {showAll ? 'Hide' : `Browse all ${contacts.length} contacts`}
          </button>
          <AnimatePresence>
            {showAll && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="border border-border rounded-xl overflow-hidden bg-card max-h-60 overflow-y-auto"
              >
                {[...contacts].sort((a, b) => a.contact_name.localeCompare(b.contact_name)).map((c) => (
                  <ContactRow key={c.id} contact={c} onClick={() => onContactSelected(c)} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {search.length < 2 && !loading && contacts.length === 0 && (
        <div className="text-center py-6 space-y-3">
          <p className="text-muted-foreground text-sm">No contacts yet — add your first recipient!</p>
        </div>
      )}

      {/* Add new button */}
      <button
        onClick={onNewContact}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <UserPlus className="h-4 w-4" /> Add New Contact
      </button>
    </div>
  );
};

const ContactRow = ({ contact, onClick }: { contact: UserContact; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0"
  >
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
      {contact.contact_name.charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground truncate">{contact.contact_name}</p>
      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
        {contact.phone ? (
          <><Phone className="h-3 w-3" />{contact.phone}</>
        ) : contact.email ? (
          <><Mail className="h-3 w-3" />{contact.email}</>
        ) : null}
      </p>
    </div>
    {contact.total_ments_sent > 0 && (
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {contact.total_ments_sent} ment{contact.total_ments_sent !== 1 ? 's' : ''}
      </span>
    )}
  </button>
);

export default ContactSelector;
