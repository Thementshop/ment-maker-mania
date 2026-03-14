import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';

interface SavedContact {
  id: string;
  contact_email: string;
  contact_name: string | null;
  times_sent: number;
}

interface SavedContactsDropdownProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (email: string) => void;
  placeholder?: string;
  className?: string;
}

const SavedContactsDropdown = ({ value, onChange, onSelect, placeholder, className }: SavedContactsDropdownProps) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredContacts, setFilteredContacts] = useState<SavedContact[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const loadContacts = async () => {
      const { data } = await supabase
        .from('saved_contacts')
        .select('id, contact_email, contact_name, times_sent')
        .eq('user_id', user.id)
        .order('last_sent_at', { ascending: false })
        .limit(20);
      if (data) setContacts(data);
    };
    loadContacts();
  }, [user]);

  useEffect(() => {
    if (!value.trim()) {
      setFilteredContacts(contacts.slice(0, 5));
    } else {
      const lower = value.toLowerCase();
      setFilteredContacts(
        contacts
          .filter(c => c.contact_email.toLowerCase().includes(lower) || c.contact_name?.toLowerCase().includes(lower))
          .slice(0, 5)
      );
    }
  }, [value, contacts]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder || 'Enter email address'}
        className={className}
      />
      {showDropdown && filteredContacts.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden"
        >
          <p className="text-xs text-muted-foreground px-3 py-1.5 border-b border-border">Recent contacts</p>
          {filteredContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => {
                onSelect(contact.contact_email);
                setShowDropdown(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-center justify-between"
            >
              <div>
                <span className="text-sm font-medium text-foreground">
                  {contact.contact_name || contact.contact_email.split('@')[0]}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {contact.contact_email}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                ×{contact.times_sent}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedContactsDropdown;
