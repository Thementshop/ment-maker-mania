import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useGameStore } from '@/store/gameStore';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<{ error: Error | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const gameStateLoadedRef = useRef(false);

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  useEffect(() => {
    let isSubscribed = true;
    
    // Timeout to prevent infinite loading - 5 second safety net
    const authTimeout = setTimeout(() => {
      if (isSubscribed) {
        console.warn('Auth check timed out, proceeding without auth');
        setIsLoading(false);
      }
    }, 5000);

    // Load game state only once per session
    const loadUserGameState = async (userId: string) => {
      if (gameStateLoadedRef.current) return;
      gameStateLoadedRef.current = true;
      
      try {
        await useGameStore.getState().loadGameState(userId);
        useGameStore.getState().subscribeToWorldCounter();
      } catch (error) {
        console.error('Failed to load game state:', error);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isSubscribed) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Set auth as complete FIRST - don't wait for game data
        setIsLoading(false);
        clearTimeout(authTimeout);
        
        if (newSession?.user) {
          const userProfile = await fetchProfile(newSession.user.id);
          if (isSubscribed) setProfile(userProfile);
          // Load game state in background (don't block auth)
          loadUserGameState(newSession.user.id);
        } else {
          setProfile(null);
          gameStateLoadedRef.current = false;
          useGameStore.getState().resetState();
          useGameStore.getState().unsubscribeFromWorldCounter();
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!isSubscribed) return;
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setIsLoading(false);  // Auth check complete immediately
      clearTimeout(authTimeout);
      
      if (existingSession?.user) {
        const userProfile = await fetchProfile(existingSession.user.id);
        if (isSubscribed) setProfile(userProfile);
        loadUserGameState(existingSession.user.id);
      }
    });

    return () => {
      isSubscribed = false;
      clearTimeout(authTimeout);
      subscription.unsubscribe();
      useGameStore.getState().unsubscribeFromWorldCounter();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: displayName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    useGameStore.getState().resetState();
  };

  const updateProfile = async (displayName: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);
    
    if (!error) {
      setProfile(prev => prev ? { ...prev, display_name: displayName } : null);
    }
    
    return { error: error as Error | null };
  };

  const updateEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        updateEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
