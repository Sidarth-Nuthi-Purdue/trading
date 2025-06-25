'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Users, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  total_pnl: number;
  daily_pnl: number;
  weekly_pnl: number;
  monthly_pnl: number;
  balance: number;
  pnl_value: number;
  pnl_percentage?: number;
}

interface Competition {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  participant_count: number;
  prize_amount: number;
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [activeTab, setActiveTab] = useState<'all_time' | 'weekly' | 'monthly' | 'daily' | 'competitions'>('all_time');
  const [selectedCompetition, setSelectedCompetition] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);
      await loadLeaderboard('all_time');
      await loadCompetitions();
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const loadLeaderboard = async (period: string, competitionId?: string) => {
    try {
      let url = `/api/paper-trading/leaderboard?period=${period}&limit=50`;
      if (competitionId) {
        url += `&competition_id=${competitionId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const loadCompetitions = async () => {
    try {
      const response = await fetch('/api/paper-trading/competitions?status=active');
      if (response.ok) {
        const data = await response.json();
        setCompetitions(data.competitions || []);
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    if (tab === 'competitions' && competitions.length > 0) {
      setSelectedCompetition(competitions[0].id);
      loadLeaderboard('active_competitions', competitions[0].id);
    } else {
      setSelectedCompetition(null);
      loadLeaderboard(tab);
    }
  };

  const handleCompetitionChange = (competitionId: string) => {
    setSelectedCompetition(competitionId);
    loadLeaderboard('active_competitions', competitionId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const currentUserRank = leaderboard.find(entry => entry.user_id === user?.id);

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
              <Trophy className="h-7 w-7 mr-2 text-yellow-400" />
              Leaderboard
            </h1>
            <p className="text-gray-400">See how you rank against other traders</p>
          </div>
          <div className="flex space-x-4">
            <Button
              onClick={() => router.push('/exchange')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Trade Now
            </Button>
            <Button
              onClick={() => router.push('/dashboard/trading')}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* User's Current Rank */}
        {currentUserRank && (
          <Card className="bg-gray-900 border-gray-700 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getRankIcon(currentUserRank.rank)}
                    <span className="text-lg font-semibold text-white">Your Rank</span>
                  </div>
                  <Badge className={`${getRankBadgeColor(currentUserRank.rank)} text-white`}>
                    #{currentUserRank.rank}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${
                    currentUserRank.pnl_value >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {currentUserRank.pnl_value >= 0 ? '+' : ''}{formatCurrency(currentUserRank.pnl_value)}
                  </div>
                  <div className="text-sm text-gray-400">
                    Balance: {formatCurrency(currentUserRank.balance)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-5 bg-gray-800 mb-6">
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
            <TabsTrigger value="competitions" className="data-[state=active]:bg-gray-700">
              Competitions
            </TabsTrigger>
          </TabsList>

          {/* Competition Selector */}
          {activeTab === 'competitions' && competitions.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center space-x-4">
                <span className="text-gray-300">Competition:</span>
                <div className="flex space-x-2">
                  {competitions.map((comp) => (
                    <Button
                      key={comp.id}
                      size="sm"
                      variant={selectedCompetition === comp.id ? "default" : "outline"}
                      onClick={() => handleCompetitionChange(comp.id)}
                      className={
                        selectedCompetition === comp.id
                          ? "bg-blue-600 text-white"
                          : "border-gray-600 text-gray-300 hover:bg-gray-800"
                      }
                    >
                      {comp.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <TabsContent value={activeTab}>
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span>
                    {activeTab === 'all_time' && 'All Time Rankings'}
                    {activeTab === 'monthly' && 'Monthly Rankings'}
                    {activeTab === 'weekly' && 'Weekly Rankings'}
                    {activeTab === 'daily' && 'Daily Rankings'}
                    {activeTab === 'competitions' && 'Competition Rankings'}
                  </span>
                  <Badge variant="outline" className="text-gray-400 border-gray-600">
                    {leaderboard.length} traders
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2 p-6">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.user_id}
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
                          <AvatarFallback className="bg-gray-700 text-white">
                            {getUserInitials(entry.first_name, entry.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <div className="font-medium text-white">
                            {entry.first_name} {entry.last_name}
                          </div>
                          <div className="text-sm text-gray-400">@{entry.username}</div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6">
                        <div className="text-right">
                          <div className={`text-lg font-semibold ${
                            entry.pnl_value >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            <div className="flex items-center space-x-1">
                              {entry.pnl_value >= 0 ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              <span>
                                {entry.pnl_value >= 0 ? '+' : ''}{formatCurrency(entry.pnl_value)}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-400">
                            Balance: {formatCurrency(entry.balance)}
                          </div>
                        </div>

                        {entry.pnl_percentage !== undefined && (
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              entry.pnl_percentage >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {entry.pnl_percentage >= 0 ? '+' : ''}{entry.pnl_percentage.toFixed(2)}%
                            </div>
                            <div className="text-xs text-gray-500">Return</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {leaderboard.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No rankings available</h3>
                      <p className="text-sm">
                        {activeTab === 'competitions' 
                          ? 'No active competitions or participants yet.'
                          : 'Start trading to appear on the leaderboard!'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Active Competitions */}
        {competitions.length > 0 && activeTab !== 'competitions' && (
          <Card className="bg-gray-900 border-gray-700 mt-8">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Trophy className="h-5 w-5 mr-2 text-yellow-400" />
                Active Competitions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitions.map((comp) => (
                  <div
                    key={comp.id}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-white">{comp.name}</h3>
                      <Badge className="bg-green-600 text-white">Active</Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-400">
                        <Users className="h-4 w-4 mr-1" />
                        {comp.participant_count} participants
                      </div>
                      <div className="flex items-center text-gray-400">
                        <Trophy className="h-4 w-4 mr-1" />
                        {formatCurrency(comp.prize_amount)} prize
                      </div>
                      <div className="flex items-center text-gray-400">
                        <Calendar className="h-4 w-4 mr-1" />
                        Ends {new Date(comp.end_date).toLocaleDateString()}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        setActiveTab('competitions');
                        handleCompetitionChange(comp.id);
                      }}
                    >
                      View Leaderboard
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}