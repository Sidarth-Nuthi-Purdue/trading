'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WhopSupabaseSyncProps {
  whopUserData?: any;
  onSyncComplete?: (supabaseSession: any) => void;
}

export function WhopSupabaseSync({ whopUserData, onSyncComplete }: WhopSupabaseSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (whopUserData && whopUserData.id && syncStatus === 'idle') {
      syncUserToSupabase();
    }
  }, [whopUserData, syncStatus]);

  const syncUserToSupabase = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus('syncing');
      console.log('Starting Whop to Supabase sync...');

      // Call the sync API
      const response = await fetch('/api/auth/whop-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(whopUserData)
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Sync result:', result);

      if (result.success) {
        // Try to create a Supabase session using the generated email
        const email = whopUserData.email || `${whopUserData.id}@whop.generated`;
        
        // Check if we can sign in with the synced user
        await checkSupabaseSession(result.user_id);
        
        setSyncStatus('success');
        console.log('Whop user successfully synced to Supabase');
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing Whop user to Supabase:', error);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const checkSupabaseSession = async (userId: string) => {
    try {
      // Check if we already have a session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.user.id === userId) {
        console.log('Already have valid Supabase session');
        onSyncComplete?.(session);
        return;
      }

      // Try to refresh session
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
      
      if (refreshedSession && refreshedSession.user.id === userId) {
        console.log('Refreshed Supabase session successfully');
        onSyncComplete?.(refreshedSession);
        return;
      }

      console.log('No valid Supabase session found, user will need to log in separately');
    } catch (error) {
      console.error('Error checking Supabase session:', error);
    }
  };

  // Don't render anything visible
  return null;
}