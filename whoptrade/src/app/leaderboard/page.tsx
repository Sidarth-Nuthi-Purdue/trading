'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Users, Star, Crown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WhopLeaderboardEntry } from '@/lib/whop-leaderboard';
import { getWhopAuthHeaders, isWhopAuthenticated } from '@/lib/whop-supabase-bridge';

export default function WhopLeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<WhopLeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'all_time' | 'weekly' | 'monthly' | 'daily'>('all_time');
  const [rankingCriteria, setRankingCriteria] = useState<'pnl' | 'win_rate' | 'total_trades' | 'balance'>('pnl');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRank, setUserRank] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      // Check if user is authenticated with Whop
      if (!isWhopAuthenticated()) {
        router.push('/login');
        return;
      }
      
      await loadLeaderboard();
      setLoading(false);
    };

    checkAuth();
  }, [router, activeTab, rankingCriteria]);

  const loadLeaderboard = async () => {
    try {
      const params = new URLSearchParams({
        time_period: activeTab,
        ranking_criteria: rankingCriteria,
        max_entries: '50',
        min_trades: '1',
        active_only: 'true'
      });
      
      const response = await fetch(`/api/whop/leaderboard?${params}`, {
        headers: getWhopAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
        
        // Find current user's rank
        const userEntry = data.leaderboard?.find((entry: WhopLeaderboardEntry) => 
          entry.whop_user_id === currentUser?.id
        );
        setUserRank(userEntry);
      } else {
        console.error('Failed to load leaderboard:', response.status);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
  };

  const handleRankingCriteriaChange = (criteria: string) => {
    setRankingCriteria(criteria as any);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-400" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-400">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-600';
      case 2:
        return 'bg-gray-600';
      case 3:
        return 'bg-amber-600';
      default:
        return 'bg-gray-700';
    }
  };

  const getUserInitials = (entry: WhopLeaderboardEntry) => {
    if (entry.display_name) {
      return entry.display_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return entry.whop_username.substring(0, 2).toUpperCase();
  };

  const getPnLValue = (entry: WhopLeaderboardEntry) => {
    switch (activeTab) {
      case 'daily':
        return entry.daily_pnl;
      case 'weekly':
        return entry.weekly_pnl;
      case 'monthly':
        return entry.monthly_pnl;
      default:
        return entry.total_pnl;
    }
  };

  const getRankingValue = (entry: WhopLeaderboardEntry) => {
    switch (rankingCriteria) {
      case 'pnl':
        return getPnLValue(entry);
      case 'win_rate':
        return entry.win_rate;
      case 'total_trades':
        return entry.total_trades;
      case 'balance':
        return entry.current_balance;
      default:
        return entry.total_pnl;
    }
  };

  const formatRankingValue = (entry: WhopLeaderboardEntry) => {
    const value = getRankingValue(entry);
    
    switch (rankingCriteria) {
      case 'pnl':
      case 'balance':
        return formatCurrency(value);
      case 'win_rate':
        return formatPercentage(value);
      case 'total_trades':
        return value.toString();
      default:
        return formatCurrency(value);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center">
              <Crown className="h-7 w-7 mr-2 text-yellow-400" />
              Whop Leaderboard
            </h1>
            <p className="text-gray-400">Compete with other traders on the Whop platform</p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={rankingCriteria} onValueChange={handleRankingCriteriaChange}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700">
                <SelectValue placeholder="Ranking Criteria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pnl">Profit & Loss</SelectItem>
                <SelectItem value="win_rate">Win Rate</SelectItem>
                <SelectItem value="total_trades">Total Trades</SelectItem>
                <SelectItem value="balance">Current Balance</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => router.push('/exchange')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Start Trading
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* User's Current Rank */}
        {userRank && (
          <Card className="bg-gray-900 border-gray-700 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getRankIcon(userRank.rank)}
                    <span className="text-lg font-semibold text-white">Your Rank</span>
                  </div>
                  <Badge className={`${getRankBadgeColor(userRank.rank)} text-white`}>
                    #{userRank.rank}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    getRankingValue(userRank) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatRankingValue(userRank)}
                  </div>
                  <div className="text-sm text-gray-400">
                    Balance: {formatCurrency(userRank.current_balance)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 mb-6">
            <TabsTrigger value="all_time" className="data-[state=active]:bg-gray-700">
              All Time
            </TabsTrigger>
            <TabsTrigger value="monthly" className="data-[state=active]:bg-gray-700">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="weekly" className="data-[state=active]:bg-gray-700">
              Weekly
            </TabsTrigger>
            <TabsTrigger value="daily" className="data-[state=active]:bg-gray-700">
              Daily
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span>
                    {activeTab === 'all_time' && 'All Time Rankings'}
                    {activeTab === 'monthly' && 'Monthly Rankings'}
                    {activeTab === 'weekly' && 'Weekly Rankings'}
                    {activeTab === 'daily' && 'Daily Rankings'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <Badge variant="outline" className="text-gray-400 border-gray-600">
                      {leaderboard.length} Whop traders
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2 p-6">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.whop_user_id}
                      className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                        entry.rank <= 3 
                          ? 'bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600' 
                          : 'bg-gray-800 hover:bg-gray-750'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-10 h-10">
                          {getRankIcon(entry.rank)}
                        </div>
                        
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={entry.avatar_url} alt={entry.display_name} />
                          <AvatarFallback className="bg-gray-700 text-white">
                            {getUserInitials(entry)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <div className="font-medium text-white">
                            {entry.display_name}
                          </div>
                          <div className="text-sm text-gray-400">
                            @{entry.whop_username} " {entry.total_trades} trades
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${
                            getRankingValue(entry) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            <div className="flex items-center space-x-1">
                              {getRankingValue(entry) >= 0 ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              <span>{formatRankingValue(entry)}</span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-400">
                            Win Rate: {formatPercentage(entry.win_rate)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {leaderboard.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No rankings available</h3>
                      <p className="text-sm">
                        Start trading to appear on the Whop leaderboard!
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}