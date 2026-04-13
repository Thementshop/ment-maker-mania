import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Phone, Mail } from 'lucide-react';
import type { UserContact } from '@/components/ContactSelector';
import { getFreshAccessToken } from '@/utils/freshToken';

interface AddContactFormProps {
  onSaved: (contact: UserContact) => void;
  onBack: () => void;
  initialName?: string;
}

const AddContactForm = ({ onSaved, onBack, initialName = '' }: AddContactFormProps) => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!phone.trim() && !email.trim()) errs.contact = 'Phone or email is required';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email';
    if (email.trim() && email.toLowerCase() === user?.email?.toLowerCase()) errs.email = "Can't add yourself";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !user) return;
    setSaving(true);
    setErrors({});

    const deliveryPref = phone.trim() ? 'text' : 'email';
    const cleanPhone = phone.trim().replace(/\D/g, '') || null;
    const cleanEmail = email.trim().toLowerCase() || null;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('App configuration is missing. Please refresh and try again.');
      }

      const freshToken = await getFreshAccessToken();
      if (!freshToken) {
        toast({ title: 'Session expired', description: 'Please sign in again.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const body = {
        contact_name: name.trim(),
        user_id: user.id,
        phone: cleanPhone,
        email: cleanEmail,
        delivery_preference: deliveryPref,
      };

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${supabaseUrl}/rest/v1/user_contacts?select=*`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${freshToken}`,
          'Prefer': 'return=representation',
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      window.clearTimeout(timeoutId);

      if (res.status === 401 || res.status === 403) {
        toast({ title: 'Session expired', description: 'Please sign in again.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const result = await res.json();

      if (!res.ok) {
        const msg = Array.isArray(result) ? result[0]?.message : result?.message || 'Unknown error';
        console.error('[AddContact] Save failed:', result);
        toast({ title: 'Could not save contact', description: msg, variant: 'destructive' });
        setSaving(false);
        return;
      }

      const saved = Array.isArray(result) ? result[0] : result;
      setSaving(false);
      onSaved(saved as UserContact);
    } catch (err: any) {
      const message = err?.name === 'AbortError'
        ? 'Saving timed out. Please try again.'
        : err?.message || 'Something went wrong';

      console.error('[AddContact] Exception:', err);
      toast({ title: 'Error saving contact', description: message, variant: 'destructive' });
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
          <UserPlus className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground">Add New Contact</h2>
        <p className="mt-1 text-sm text-muted-foreground">Save them for quick sending next time</p>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sarah, Mom, Coach Mike..."
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Phone - primary */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" /> Phone
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Email - secondary */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" /> or email instead
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        {errors.contact && <p className="text-xs text-destructive text-center">{errors.contact}</p>}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
      >
        {saving ? 'Saving...' : 'Save & Continue'}
      </button>
      <button onClick={onBack} className="w-full text-sm text-muted-foreground hover:text-foreground">← Back</button>
    </div>
  );
};

export default AddContactForm;
