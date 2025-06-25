'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, TrendingUp, TrendingDown, Users, Calendar, Award, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import LeaderboardConfigurator from './leaderboard-configurator';

interface LeaderboardEntry {
  user_id: string;
  rank: number;
  pnl: number;
  user_profiles: {
    username: string;
    first_name: string;
    last_name: string;
    created_at: string;
  };
  balance?: number;
  competitions?: {
    name: string;
    status: string;
  };
}

interface LeaderboardManagerProps {
  onStatsUpdate: () => void;
}

export default function LeaderboardManager({ onStatsUpdate }: LeaderboardManagerProps) {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'view' | 'configure'>('view');
  const [viewType, setViewType] = useState<'global' | 'competition'>('global');
  const [timeframe, setTimeframe] = useState('all_time');
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('');
  const [leaderboardConfigs, setLeaderboardConfigs] = useState<any[]>([]);

  useEffect(() => {
    loadCompetitions();
    loadLeaderboard();
    loadLeaderboardConfigs();
  }, []);

  useEffect(() => {
    if (activeTab === 'view') {
      loadLeaderboard();
    }
  }, [activeTab, viewType, timeframe, selectedCompetition]);

  const loadCompetitions = async () => {
    try {
      const response = await fetch('/api/creator/competitions');
      if (response.ok) {
        const data = await response.json();
        setCompetitions(data.competitions || []);
        if (data.competitions?.length > 0) {
          setSelectedCompetition(data.competitions[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
    }
  };

  const loadLeaderboardConfigs = async () => {
    try {
      const response = await fetch('/api/creator/leaderboard-configs');
      if (response.ok) {
        const data = await response.json();
        setLeaderboardConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Error loading leaderboard configs:', error);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: viewType,
        limit: '50'
      });

      if (viewType === 'global') {
        params.append('timeframe', timeframe);
      } else if (selectedCompetition) {
        params.append('competition_id', selectedCompetition);
      }

      const response = await fetch(`/api/creator/leaderboard?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
      } else {
        console.error('Failed to load leaderboard:', response.status);
        setLeaderboard([]);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPnLColor = (value: number) => {
    return value >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-400" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-300" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-400">#{rank}</span>;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank <= 3) {
      const colors = {
        1: 'bg-yellow-600 text-yellow-100',
        2: 'bg-gray-600 text-gray-100',
        3: 'bg-amber-600 text-amber-100'
      };
      return colors[rank as keyof typeof colors];
    }
    return 'bg-gray-700 text-gray-200';
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleConfigSave = (config: any) => {
    loadLeaderboardConfigs();
    setActiveTab('view');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Leaderboard Management</h2>
          <p className="text-gray-400">View, configure, and manage leaderboards</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setActiveTab('configure')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Leaderboard
          </Button>
          
          {activeTab === 'view' && (
            <Button
              onClick={loadLeaderboard}
              variant="outline"
              className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'view' | 'configure')}>
        <TabsList className="grid w-full grid-cols-2 bg-gray-800">
          <TabsTrigger value="view" className="data-[state=active]:bg-gray-700">
            <Trophy className="h-4 w-4 mr-2" />
            View Leaderboards
          </TabsTrigger>
          <TabsTrigger value="configure" className="data-[state=active]:bg-gray-700">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view">
          {/* Controls */}
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <Tabs value={viewType} onValueChange={(value) => setViewType(value as any)}>
                  <TabsList className="bg-gray-800">
                    <TabsTrigger value="global" className="data-[state=active]:bg-gray-700">
                      <Trophy className="h-4 w-4 mr-2" />
                      Global Rankings
                    </TabsTrigger>
                    <TabsTrigger value="competition" className="data-[state=active]:bg-gray-700">
                      <Users className="h-4 w-4 mr-2" />
                      Competition
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {viewType === 'global' && (
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      <SelectItem value="all_time" className="text-white">All Time</SelectItem>
                      <SelectItem value="monthly" className="text-white">This Month</SelectItem>
                      <SelectItem value="weekly" className="text-white">This Week</SelectItem>
                      <SelectItem value="daily" className="text-white">Today</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {viewType === 'competition' && (
                  <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                    <SelectTrigger className="w-60 bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder="Select competition" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {competitions.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id} className="text-white">
                          {comp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Trophy className="h-5 w-5 mr-2" />
                {viewType === 'global' 
                  ? `Global Leaderboard - ${timeframe.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
                  : `Competition Leaderboard`
                }
              </CardTitle>
            </CardHeader>
        <CardContent>
          {leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    entry.rank <= 3 
                      ? 'bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600' 
                      : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-12">
                      {entry.rank <= 3 ? (
                        <Badge className={`${getRankBadge(entry.rank)} px-2 py-1`}>
                          {getRankIcon(entry.rank)}
                        </Badge>
                      ) : (
                        getRankIcon(entry.rank)
                      )}
                    </div>

                    {/* User Info */}
                    <div>
                      <div className="font-medium text-white">
                        {entry.user_profiles.first_name} {entry.user_profiles.last_name}
                      </div>
                      <div className="text-sm text-gray-400">
                        @{entry.user_profiles.username}
                      </div>
                      <div className="text-xs text-gray-500">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Joined {formatDate(entry.user_profiles.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {/* P&L */}
                    <div className={`text-lg font-bold ${getPnLColor(entry.pnl)}`}>
                      {entry.pnl >= 0 ? '+' : ''}{formatCurrency(entry.pnl)}
                    </div>
                    
                    {/* Balance (for global leaderboard) */}
                    {viewType === 'global' && entry.balance && (
                      <div className="text-sm text-gray-400">
                        Balance: {formatCurrency(entry.balance)}
                      </div>
                    )}

                    {/* Competition info */}
                    {viewType === 'competition' && entry.competitions && (
                      <div className="text-sm text-gray-400">
                        {entry.competitions.name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No rankings available</p>
              <p className="text-sm">
                {viewType === 'global' 
                  ? 'Rankings will appear once users start trading'
                  : 'Select a competition to view rankings'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

          {/* Statistics */}
          {leaderboard.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Top Performer</p>
                      <p className="text-lg font-bold text-green-400">
                        {leaderboard[0]?.pnl >= 0 ? '+' : ''}{formatCurrency(leaderboard[0]?.pnl || 0)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Average P&L</p>
                      <p className={`text-lg font-bold ${getPnLColor(
                        leaderboard.reduce((sum, entry) => sum + entry.pnl, 0) / leaderboard.length
                      )}`}>
                        {formatCurrency(
                          leaderboard.reduce((sum, entry) => sum + entry.pnl, 0) / leaderboard.length
                        )}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Profitable Traders</p>
                      <p className="text-lg font-bold text-white">
                        {Math.round((leaderboard.filter(entry => entry.pnl > 0).length / leaderboard.length) * 100)}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="configure">
          <LeaderboardConfigurator 
            onConfigSave={handleConfigSave}
            competitions={competitions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}