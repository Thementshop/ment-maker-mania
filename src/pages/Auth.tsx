import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import unwrappedMint from '@/assets/unwrapped-mint.png';

const Auth = () => {
  const { user, isLoading, signUp, signIn } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Read returnTo from URL params
  const searchParams = new URLSearchParams(window.location.search);
  const returnTo = searchParams.get('returnTo') || '/';

  // Redirect if already logged in
  if (!isLoading && user) {
    return <Navigate to={returnTo} replace />;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match.',
        variant: 'destructive',
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    const { error } = await signUp(email, password, displayName);
    
    if (error) {
      toast({
        title: 'Signup failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsSubmitting(false);
    } else {
      setIsSettingUp(true);
      toast({
        title: 'Welcome to The Ment Shop!',
        description: 'Setting up your mint jar...',
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: 'Missing fields',
        description: 'Please enter your email and password.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsSubmitting(false);
    } else {
      toast({
        title: 'Welcome back!',
        description: 'Loading your mint jar...',
      });
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setEmail('');
    setPassword('');
    setDisplayName('');
    setConfirmPassword('');
  };

  if (isLoading || isSettingUp) {
    return (
      <div className="min-h-screen bg-gradient-mint flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <img src={unwrappedMint} alt="Loading..." className="h-16 w-16" />
        </motion.div>
        {isSettingUp && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground font-medium"
          >
            Creating your mint jar...
          </motion.p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-mint flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <motion.img
          src={unwrappedMint}
          alt="The Ment Shop"
          className="h-20 w-20 mx-auto mb-4"
          animate={{ 
            y: [0, -5, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <h1 className="font-display text-3xl font-bold text-foreground">
          The Ment Shop
        </h1>
        <p className="text-muted-foreground mt-2">
          The candy store of compliments
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        key={isLoginMode ? 'login' : 'signup'}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-3xl shadow-2xl p-6 border border-border">
          <h2 className="font-display text-xl font-bold text-center mb-6">
            {isLoginMode ? 'Welcome Back!' : 'Create Your Account'}
          </h2>
          
          {isLoginMode ? (
            // Login Form
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-mint hover:bg-mint/90 text-primary-foreground font-display"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          ) : (
            // Signup Form
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-mint hover:bg-mint/90 text-primary-foreground font-display"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating account...' : 'Start Spreading Kindness'}
              </Button>
            </form>
          )}
          
          {/* Toggle between modes */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLoginMode ? (
                <>New here? <span className="text-mint font-medium">Create an account</span></>
              ) : (
                <>Already have an account? <span className="text-mint font-medium">Sign in</span></>
              )}
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            Your session is saved automatically — no need to log in again!
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
