import { useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@services/supabase';
import { signInWithGoogle as authSignIn, signOut as authSignOut } from '@services/auth';
import type { AuthResult, SignOutResult } from '@services/auth';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSigningIn: boolean;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<SignOutResult>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    setIsSigningIn(true);
    try {
      return await authSignIn();
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<SignOutResult> => {
    return authSignOut();
  }, []);

  return {
    user,
    session,
    isLoading,
    isAuthenticated: user !== null,
    isSigningIn,
    signInWithGoogle,
    signOut,
  };
}
