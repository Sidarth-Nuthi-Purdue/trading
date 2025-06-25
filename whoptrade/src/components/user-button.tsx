'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSupabase } from '@/components/auth-provider';
import { Loader2 } from 'lucide-react';

export function UserButton() {
  const { user, loading, signOut } = useSupabase();
  
  if (loading) {
    return (
      <Button variant="ghost" size="sm" className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }
  
  if (!user) {
    return null;
  }
  
  // Get user initials for the avatar fallback
  const getInitials = () => {
    if (!user?.email) return 'U';
    
    const parts = user.email.split('@')[0].split(/[._-]/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">
              {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
            </span>
            <span className="text-xs text-muted-foreground">Paper Trading</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.location.href = '/dashboard/settings'}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.location.href = '/dashboard/portfolio'}>
          Portfolio
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 