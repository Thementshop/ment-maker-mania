import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings, Check, LogOut, Loader2 } from 'lucide-react';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountSettingsModal = ({ isOpen, onClose }: AccountSettingsModalProps) => {
  const { user, profile, updateProfile, updateEmail, updatePassword, signOut } = useAuth();
  const { toast } = useToast();

  // Display name state
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Email state
  const [email, setEmail] = useState(user?.email || '');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Signing out state
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleUpdateDisplayName = async () => {
    if (!displayName.trim()) {
      toast({
        title: 'Error',
        description: 'Display name cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingName(true);
    const { error } = await updateProfile(displayName.trim());
    setIsUpdatingName(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Display name updated!',
      });
    }
  };

  const handleUpdateEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingEmail(true);
    const { error } = await updateEmail(email.trim());
    setIsUpdatingEmail(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Confirmation Email Sent',
        description: 'Please check your new email address to confirm the change.',
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await updatePassword(newPassword);
    setIsUpdatingPassword(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Password updated successfully!',
      });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Settings className="h-5 w-5 text-primary" />
            Account Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Display Name Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Label htmlFor="displayName" className="text-sm font-medium">
              Display Name
            </Label>
            <div className="flex gap-2">
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="flex-1"
              />
              <Button
                onClick={handleUpdateDisplayName}
                disabled={isUpdatingName || displayName === profile?.display_name}
                size="icon"
                className="bg-primary hover:bg-primary/90"
              >
                {isUpdatingName ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
            </div>
          </motion.div>

          {/* Email Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1"
              />
              <Button
                onClick={handleUpdateEmail}
                disabled={isUpdatingEmail || email === user?.email}
                size="icon"
                className="bg-primary hover:bg-primary/90"
              >
                {isUpdatingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A confirmation email will be sent to your new address
            </p>
          </motion.div>

          {/* Password Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <Label className="text-sm font-medium">Change Password</Label>
            <div className="space-y-2">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="flex-1"
                />
                <Button
                  onClick={handleUpdatePassword}
                  disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                  size="icon"
                  className="bg-primary hover:bg-primary/90"
                >
                  {isUpdatingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Sign Out Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={handleSignOut}
              disabled={isSigningOut}
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign Out
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountSettingsModal;
