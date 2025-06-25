'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Calendar,
  Download,
  Plus,
  SearchIcon,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Settings,
  Crown
} from 'lucide-react';
import UsersTable from '@/components/creator/users-table';
import CompetitionManager from '@/components/creator/competition-manager';
import GlobalSettings from '@/components/creator/global-settings';
import LeaderboardManager from '@/components/creator/leaderboard-manager';
import AnalyticsDashboard from '@/components/creator/analytics-dashboard';
import PnLRecalculator from '@/components/creator/pnl-recalculator';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalCompetitions: number;
  totalPrizes: number;
  avgPnL: number;
  avgWinRate: number;
  avgTrades: number;
  totalVolume: number;
  topAssets: Array<{ symbol: string; trades: number }>;
}

export default function CreatorDashboardPage() {
  const [selectedTab, setSelectedTab] = useState('users');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Load analytics data from creator API
      const response = await fetch('/api/creator/analytics');
      if (response.ok) {
        const data = await response.json();
        const analytics = data.analytics;
        
        // Get competitions data
        const competitionsResponse = await fetch('/api/creator/competitions');
        let totalCompetitions = 0;
        let totalPrizes = 0;
        
        if (competitionsResponse.ok) {
          const competitionsData = await competitionsResponse.json();
          totalCompetitions = competitionsData.length || 0;
          totalPrizes = competitionsData.reduce((sum: number, comp: any) => sum + (comp.prize_pool || 0), 0);
        }
        
        setAnalytics({
          totalUsers: analytics?.overview?.total_users || 0,
          activeUsers: analytics?.overview?.active_users || 0,
          totalCompetitions: totalCompetitions,
          totalPrizes: totalPrizes,
          avgPnL: analytics?.overview?.avg_pnl || 0,
          avgWinRate: analytics?.overview?.fill_rate || 0, // Using fill rate as proxy for win rate
          avgTrades: analytics?.overview?.total_orders && analytics?.overview?.total_users ? 
            Math.round(analytics.overview.total_orders / analytics.overview.total_users) : 0,
          totalVolume: analytics?.overview?.total_volume || 0,
          topAssets: [], // Will be calculated from orders data
        });
      } else {
        console.error('Failed to load analytics, using fallback data');
        // Set fallback analytics data
        setAnalytics({
          totalUsers: 0,
          activeUsers: 0,
          totalCompetitions: 0,
          totalPrizes: 0,
          avgPnL: 0,
          avgWinRate: 0,
          avgTrades: 0,
          totalVolume: 0,
          topAssets: [],
        });
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      // Set empty fallback data
      setAnalytics({
        totalUsers: 0,
        activeUsers: 0,
        totalCompetitions: 0,
        totalPrizes: 0,
        avgPnL: 0,
        avgWinRate: 0,
        avgTrades: 0,
        totalVolume: 0,
        topAssets: [],
      });
    } finally {
      setLoading(false);
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

  if (loading) {
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
              <p className="text-gray-400 mt-1">Manage your trading platform and competitions</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700">
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Analytics Cards */}
      <div className="container mx-auto py-6 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-400">Total Users</p>
                  <h3 className="text-2xl font-bold mt-1 text-white">{analytics?.totalUsers || 0}</h3>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                <span className="text-green-400">+12%</span> from last month
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-400">Average P&L</p>
                  <h3 className="text-2xl font-bold mt-1 text-green-400">
                    +{formatCurrency(analytics?.avgPnL || 0)}
                  </h3>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                <span className="text-green-400">+8.5%</span> from last month
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-400">Total Competitions</p>
                  <h3 className="text-2xl font-bold mt-1 text-white">{analytics?.totalCompetitions || 0}</h3>
                </div>
                <Trophy className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                <span className="text-green-400">+2</span> from last month
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-400">Total Prize Money</p>
                  <h3 className="text-2xl font-bold mt-1 text-white">
                    {formatCurrency(analytics?.totalPrizes || 0)}
                  </h3>
                </div>
                <Wallet className="h-8 w-8 text-green-500" />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                <span className="text-green-400">+$1,200</span> from last month
              </div>
            </CardContent>
          </Card>
        </div>
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
              value="leaderboard"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300"
            >
              <Crown className="mr-2 h-4 w-4" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-300"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
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
            <UsersTable onStatsUpdate={loadAnalytics} />
          </TabsContent>
          
          {/* Competitions Tab */}
          <TabsContent value="competitions" className="space-y-4">
            <CompetitionManager onStatsUpdate={loadAnalytics} />
          </TabsContent>
          
          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4">
            <LeaderboardManager onStatsUpdate={loadAnalytics} />
          </TabsContent>
          
          
          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <AnalyticsDashboard onStatsUpdate={loadAnalytics} />
          </TabsContent>
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <GlobalSettings />
              </div>
              <div>
                <PnLRecalculator onComplete={loadAnalytics} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 