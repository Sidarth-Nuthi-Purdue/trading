'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Users, Star, Crown, Plus, Calendar, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWhopAuthHeaders, isWhopAuthenticated } from '@/lib/whop-supabase-bridge';

interface Competition {
  id: string;
  name: string;
  description?: string;
  status: string;
  type: string;
  starting_balance: number;
  max_participants: number;
  participant_count: number;
  spots_remaining: number;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  ranking_criteria: string;
  created_at: string;
  user_profiles: {
    username: string;
    first_name: string;
    last_name: string;
  };
  user_participation?: any;
  leaderboard?: CompetitionLeaderboardEntry[];
}

interface CompetitionLeaderboardEntry {
  participant_id: string;
  user_id: string;
  whop_user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  current_balance: number;
  total_pnl: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  current_rank: number;
  competition_name: string;
}

export default function CompetitionsPage() {
  const [loading, setLoading] = useState(true);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'my_competitions'>('browse');
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
      
      await loadCompetitions();
      setLoading(false);
    };

    checkAuth();
  }, [router, activeTab]);

  const loadCompetitions = async () => {
    try {
      const statusFilter = activeTab === 'browse' ? 'active' : undefined;
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      
      const response = await fetch(`/api/competitions?${params}`, {
        headers: getWhopAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setCompetitions(data.competitions || []);
      } else {
        console.error('Failed to load competitions:', response.status);
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
    }
  };

  const loadCompetitionLeaderboard = async (competitionId: string) => {
    try {
      const response = await fetch(`/api/competitions/${competitionId}/leaderboard`, {
        headers: getWhopAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
        setUserRank(data.user_rank);
      } else {
        console.error('Failed to load competition leaderboard:', response.status);
      }
    } catch (error) {
      console.error('Error loading competition leaderboard:', error);
    }
  };

  const joinCompetition = async (competitionId: string, invitationCode?: string) => {
    try {
      const response = await fetch(`/api/competitions/${competitionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getWhopAuthHeaders()
        },
        body: JSON.stringify({ invitation_code: invitationCode })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Successfully joined competition! Starting balance: ${formatCurrency(data.starting_balance)}`);
        await loadCompetitions(); // Reload competitions
      } else {
        const error = await response.json();
        alert(`Failed to join competition: ${error.error}`);
      }
    } catch (error) {
      console.error('Error joining competition:', error);
      alert('Error joining competition');
    }
  };

  const handleCompetitionClick = async (competition: Competition) => {
    setSelectedCompetition(competition);
    await loadCompetitionLeaderboard(competition.id);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
    setSelectedCompetition(null); // Clear selected competition when changing tabs
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

  const getUserInitials = (entry: CompetitionLeaderboardEntry) => {
    if (entry.first_name && entry.last_name) {
      return `${entry.first_name[0]}${entry.last_name[0]}`.toUpperCase();
    }
    return entry.username.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCompetitionStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-600';
      case 'draft': return 'bg-yellow-600';
      case 'ended': return 'bg-gray-600';
      case 'cancelled': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'invite_only': return 'bg-purple-600';
      case 'public': return 'bg-blue-600';
      default: return 'bg-gray-600';
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
              <Trophy className="h-7 w-7 mr-2 text-yellow-400" />
              Trading Competitions
            </h1>
            <p className="text-gray-400">Compete in exclusive trading competitions with isolated balances</p>
          </div>
          <div className="flex items-center space-x-4">
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
        {/* Competition Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-800 mb-6">
            <TabsTrigger value="browse" className="data-[state=active]:bg-gray-700">
              Browse Competitions
            </TabsTrigger>
            <TabsTrigger value="my_competitions" className="data-[state=active]:bg-gray-700">
              My Competitions
            </TabsTrigger>
          </TabsList>

          {!selectedCompetition ? (
            // Competitions List View
            <TabsContent value={activeTab}>
              <div className="grid gap-6">
                {competitions.map((competition) => (
                  <Card 
                    key={competition.id} 
                    className="bg-gray-900 border-gray-700 cursor-pointer hover:border-gray-600 transition-colors"
                    onClick={() => handleCompetitionClick(competition)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white flex items-center space-x-3">
                          <Trophy className="h-6 w-6 text-yellow-400" />
                          <span>{competition.name}</span>
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge className={`${getCompetitionStatusColor(competition.status)} text-white`}>
                            {competition.status}
                          </Badge>
                          <Badge className={`${getTypeColor(competition.type)} text-white`}>
                            {competition.type === 'invite_only' ? 'Invite Only' : 'Public'}
                          </Badge>
                        </div>
                      </div>
                      {competition.description && (
                        <p className="text-gray-400 mt-2">{competition.description}</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-gray-400">Starting Balance</div>
                          <div className="font-semibold text-white">{formatCurrency(competition.starting_balance)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Participants</div>
                          <div className="font-semibold text-white">
                            {competition.participant_count}/{competition.max_participants}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Starts</div>
                          <div className="font-semibold text-white">{formatDate(competition.start_date)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Ends</div>
                          <div className="font-semibold text-white">{formatDate(competition.end_date)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-gray-400">
                          Created by {competition.user_profiles.first_name} {competition.user_profiles.last_name}
                        </div>
                        {competition.user_participation ? (
                          <Badge className="bg-green-600 text-white">
                            Participating
                          </Badge>
                        ) : competition.spots_remaining > 0 ? (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              const inviteCode = competition.type === 'invite_only' 
                                ? prompt('Enter invitation code:') 
                                : undefined;
                              if (competition.type !== 'invite_only' || inviteCode) {
                                joinCompetition(competition.id, inviteCode);
                              }
                            }}
                          >
                            {competition.type === 'invite_only' ? 'Join with Code' : 'Join'}
                          </Button>
                        ) : (
                          <Badge className="bg-red-600 text-white">
                            Full
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {competitions.length === 0 && (
                  <Card className="bg-gray-900 border-gray-700">
                    <CardContent className="text-center py-12">
                      <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50 text-gray-400" />
                      <h3 className="text-lg font-medium mb-2 text-white">No competitions available</h3>
                      <p className="text-sm text-gray-400">
                        {activeTab === 'browse' 
                          ? 'Check back later for new competitions!' 
                          : 'You are not participating in any competitions.'}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          ) : (
            // Competition Detail View with Leaderboard
            <div>
              <Button 
                onClick={() => setSelectedCompetition(null)}
                className="mb-6 bg-gray-800 hover:bg-gray-700"
              >
                ← Back to Competitions
              </Button>

              {/* User's Current Rank */}
              {userRank && (
                <Card className="bg-gray-900 border-gray-700 mb-8">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getRankIcon(userRank.current_rank)}
                          <span className="text-lg font-semibold text-white">Your Rank in {selectedCompetition.name}</span>
                        </div>
                        <Badge className={`${getRankBadgeColor(userRank.current_rank)} text-white`}>
                          #{userRank.current_rank}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          userRank.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {userRank.total_pnl >= 0 ? '+' : ''}{formatCurrency(userRank.total_pnl)}
                        </div>
                        <div className="text-sm text-gray-400">
                          Balance: {formatCurrency(userRank.current_balance)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Leaderboard */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span>{selectedCompetition.name} Leaderboard</span>
                    <Badge variant="outline" className="text-gray-400 border-gray-600">
                      {leaderboard.length} participants
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-2 p-6">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.participant_id}
                        className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                          entry.current_rank <= 3 
                            ? 'bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600' 
                            : 'bg-gray-800 hover:bg-gray-750'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center justify-center w-10 h-10">
                            {getRankIcon(entry.current_rank)}
                          </div>
                          
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gray-700 text-white">
                              {getUserInitials(entry)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="font-medium text-white">
                              {entry.first_name} {entry.last_name}
                            </div>
                            <div className="text-sm text-gray-400">
                              @{entry.username} • {entry.total_trades} trades
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-6">
                          <div className="text-right">
                            <div className={`text-lg font-semibold ${
                              entry.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              <div className="flex items-center space-x-1">
                                {entry.total_pnl >= 0 ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : (
                                  <TrendingDown className="h-4 w-4" />
                                )}
                                <span>{entry.total_pnl >= 0 ? '+' : ''}{formatCurrency(entry.total_pnl)}</span>
                              </div>
                            </div>
                            <div className="text-sm text-gray-400">
                              Balance: {formatCurrency(entry.current_balance)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {leaderboard.length === 0 && (
                      <div className="text-center py-12 text-gray-400">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No participants yet</h3>
                        <p className="text-sm">
                          Be the first to join this competition!
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </Tabs>
      </div>
    </div>
  );
}