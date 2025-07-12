'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Settings,
  Crown,
  LogOut,
  Users,
  Trophy
} from 'lucide-react';
import UsersTable from '@/components/creator/users-table';
import CompetitionManager from '@/components/creator/competition-manager';
import GlobalSettings from '@/components/creator/global-settings';
import PnLRecalculator from '@/components/creator/pnl-recalculator';


export default function CreatorDashboardPage() {
  const [selectedTab, setSelectedTab] = useState('users');
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/creator/auth/verify');
      
      if (!response.ok) {
        router.push('/creator/auth');
        return;
      }

      const data = await response.json();
      if (!data.authenticated) {
        router.push('/creator/auth');
        return;
      }

      setUser(data.user);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/creator/auth');
    } finally {
      setAuthChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/creator/auth/logout', { method: 'POST' });
      router.push('/creator/auth');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="container mx-auto py-6 px-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Creator Dashboard</h1>
              <p className="text-gray-400 mt-1">
                Welcome back, {user?.username} • {user?.company_name || 'Personal Account'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700">
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
              <Button 
                variant="outline" 
                className="bg-red-900 border-red-700 text-red-300 hover:bg-red-800"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto py-6 px-4">
        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          <TabsList className="bg-gray-800 border-gray-700">
            <TabsTrigger 
              value="users" 
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300"
            >
              <Users className="mr-2 h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="competitions"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300"
            >
              <Trophy className="mr-2 h-4 w-4" />
              Competitions
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300"
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <UsersTable />
          </TabsContent>
          
          {/* Competitions Tab */}
          <TabsContent value="competitions" className="space-y-4">
            <CompetitionManager />
          </TabsContent>
          
          
          
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <GlobalSettings />
              </div>
              <div>
                <PnLRecalculator />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 