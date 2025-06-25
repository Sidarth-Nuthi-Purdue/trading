'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

const SupabaseContext = createContext<{
  user: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<any>;
  error: string | null;
}>({
  user: null,
  loading: true,
  signIn: async () => null,
  signOut: async () => null,
  error: null,
});

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Clear problematic cookies on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const clearCookie = (name: string, path = '/') => {
        document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`;
      };
      
      // Clear any potentially corrupted cookies
      clearCookie('sb-emscntnnljbgjrxeeolm-auth-token');
      clearCookie('supabase-auth-token');
    }
  }, []);
  
  // Create a supabase client configured for use in the browser
  const supabase = createClientComponentClient({
    cookieOptions: {
      name: "sb-auth-token",
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });

  useEffect(() => {
    const getSession = async () => {
      try {
        setLoading(true);
        
        // Try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(sessionError.message);
        }
        
        if (session) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth provider error:', err);
        setError(err instanceof Error ? err.message : 'Authentication error');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Call getSession immediately
    getSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (signInError) {
        setError(signInError.message);
        return { error: signInError };
      }
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        setError(signOutError.message);
        return { error: signOutError };
      }
      
      // Redirect to login page after sign out
      router.push('/login');
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign out';
      setError(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  return (
    <SupabaseContext.Provider value={{ user, loading, signIn, signOut, error }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => useContext(SupabaseContext); 