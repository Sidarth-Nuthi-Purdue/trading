'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trophy, Users, Calendar, DollarSign, Play, Pause, X, Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Competition {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  prize_amount: number;
  prize_currency: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  max_participants?: number;
  entry_fee: number;
  participant_count: number;
  is_participating: boolean;
  prize_pool?: number;
  rules?: {
    prize_distribution?: Array<{
      position: number;
      amount: number;
      percentage: number;
    }>;
  };
}

interface CompetitionManagerProps {
  onStatsUpdate: () => void;
}

export default function CompetitionManager({ onStatsUpdate }: CompetitionManagerProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');
  
  const [newCompetition, setNewCompetition] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    prize_amount: 500,
    prize_currency: 'USD',
    max_participants: '',
    entry_fee: 0,
    prize_distribution: [
      { position: 1, amount: 300, percentage: 60 },
      { position: 2, amount: 150, percentage: 30 },
      { position: 3, amount: 50, percentage: 10 }
    ]
  });

  useEffect(() => {
    loadCompetitions();
  }, []);

  const loadCompetitions = async () => {
    try {
      const response = await fetch('/api/creator/competitions');
      if (response.ok) {
        const data = await response.json();
        setCompetitions(Array.isArray(data) ? data : data.competitions || []);
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCompetition = async () => {
    if (!newCompetition.name || !newCompetition.start_date || !newCompetition.end_date) {
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/creator/competitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newCompetition,
          max_participants: newCompetition.max_participants ? parseInt(newCompetition.max_participants) : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Competition created:', result);
        
        // Refresh competitions and stats
        await loadCompetitions();
        onStatsUpdate();
        
        // Reset form and close modal
        setNewCompetition({
          name: '',
          description: '',
          start_date: '',
          end_date: '',
          prize_amount: 500,
          prize_currency: 'USD',
          max_participants: '',
          entry_fee: 0,
          prize_distribution: [
            { position: 1, amount: 300, percentage: 60 },
            { position: 2, amount: 150, percentage: 30 },
            { position: 3, amount: 50, percentage: 10 }
          ]
        });
        setCreateModalOpen(false);
      } else {
        const error = await response.json();
        console.error('Failed to create competition:', error.error);
      }
    } catch (error) {
      console.error('Error creating competition:', error);
    } finally {
      setCreating(false);
    }
  };

  const getFilteredCompetitions = () => {
    switch (activeTab) {
      case 'active':
        return competitions.filter(comp => comp.status === 'active');
      case 'upcoming':
        return competitions.filter(comp => comp.status === 'upcoming');
      case 'completed':
        return competitions.filter(comp => comp.status === 'completed');
      default:
        return competitions;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-600';
      case 'upcoming':
        return 'bg-blue-600';
      case 'completed':
        return 'bg-gray-600';
      case 'cancelled':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getStatusCounts = () => {
    return {
      all: competitions.length,
      active: competitions.filter(c => c.status === 'active').length,
      upcoming: competitions.filter(c => c.status === 'upcoming').length,
      completed: competitions.filter(c => c.status === 'completed').length
    };
  };

  const updatePrizeDistribution = (index: number, field: 'amount' | 'percentage', value: number) => {
    const newDistribution = [...newCompetition.prize_distribution];
    newDistribution[index] = { ...newDistribution[index], [field]: value };
    
    // If updating amount, recalculate percentage
    if (field === 'amount') {
      const totalAmount = newCompetition.prize_amount;
      newDistribution[index].percentage = totalAmount > 0 ? (value / totalAmount) * 100 : 0;
    }
    
    // If updating percentage, recalculate amount
    if (field === 'percentage') {
      const totalAmount = newCompetition.prize_amount;
      newDistribution[index].amount = (value / 100) * totalAmount;
    }
    
    setNewCompetition({ ...newCompetition, prize_distribution: newDistribution });
  };

  const updateTotalPrizeAmount = (amount: number) => {
    const newDistribution = newCompetition.prize_distribution.map(prize => ({
      ...prize,
      amount: (prize.percentage / 100) * amount
    }));
    
    setNewCompetition({ 
      ...newCompetition, 
      prize_amount: amount,
      prize_distribution: newDistribution 
    });
  };

  const addPrizeTier = () => {
    const newDistribution = [...newCompetition.prize_distribution, {
      position: newCompetition.prize_distribution.length + 1,
      amount: 0,
      percentage: 0
    }];
    
    setNewCompetition({ ...newCompetition, prize_distribution: newDistribution });
  };

  const removePrizeTier = (index: number) => {
    if (newCompetition.prize_distribution.length > 1) {
      const newDistribution = newCompetition.prize_distribution.filter((_, i) => i !== index);
      setNewCompetition({ ...newCompetition, prize_distribution: newDistribution });
    }
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

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Competition Management</h2>
          <p className="text-gray-400">Create and manage trading competitions</p>
        </div>
        
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Competition
            </Button>
          </DialogTrigger>
          
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Competition</DialogTitle>
              <DialogDescription className="text-gray-400">
                Set up a new trading competition for your users.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-300">Competition Name</Label>
                <Input
                  id="name"
                  value={newCompetition.name}
                  onChange={(e) => setNewCompetition({...newCompetition, name: e.target.value})}
                  placeholder="e.g., Weekly Trading Challenge"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-300">Description</Label>
                <Textarea
                  id="description"
                  value={newCompetition.description}
                  onChange={(e) => setNewCompetition({...newCompetition, description: e.target.value})}
                  placeholder="Describe the competition rules and objectives"
                  className="bg-gray-800 border-gray-600 text-white"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-gray-300">Start Date</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={newCompetition.start_date}
                    onChange={(e) => setNewCompetition({...newCompetition, start_date: e.target.value})}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-gray-300">End Date</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={newCompetition.end_date}
                    onChange={(e) => setNewCompetition({...newCompetition, end_date: e.target.value})}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prize" className="text-gray-300">Total Prize Pool ($)</Label>
                  <Input
                    id="prize"
                    type="number"
                    min="0"
                    value={newCompetition.prize_amount}
                    onChange={(e) => updateTotalPrizeAmount(parseFloat(e.target.value) || 0)}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400">This will be distributed among winners</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxParticipants" className="text-gray-300">Max Participants</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    min="1"
                    value={newCompetition.max_participants}
                    onChange={(e) => setNewCompetition({...newCompetition, max_participants: e.target.value})}
                    placeholder="Unlimited"
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entryFee" className="text-gray-300">Entry Fee ($)</Label>
                <Input
                  id="entryFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newCompetition.entry_fee}
                  onChange={(e) => setNewCompetition({...newCompetition, entry_fee: parseFloat(e.target.value)})}
                  className="bg-gray-800 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400">Set to 0 for free competition</p>
              </div>

              {/* Prize Distribution */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300">Prize Distribution</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPrizeTier}
                    className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Tier
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {newCompetition.prize_distribution.map((prize, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                      <span className="text-sm text-gray-400 w-8">#{prize.position}</span>
                      
                      <div className="flex-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={prize.amount}
                          onChange={(e) => updatePrizeDistribution(index, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="Amount"
                          className="bg-gray-700 border-gray-600 text-white text-sm"
                        />
                      </div>
                      
                      <div className="w-16">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={prize.percentage.toFixed(1)}
                          onChange={(e) => updatePrizeDistribution(index, 'percentage', parseFloat(e.target.value) || 0)}
                          placeholder="%"
                          className="bg-gray-700 border-gray-600 text-white text-sm"
                        />
                      </div>
                      
                      {newCompetition.prize_distribution.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removePrizeTier(index)}
                          className="bg-red-800 border-red-600 text-red-300 hover:bg-red-700 p-1 h-8 w-8"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="text-xs text-gray-400">
                  Total: ${newCompetition.prize_distribution.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} 
                  ({newCompetition.prize_distribution.reduce((sum, p) => sum + p.percentage, 0).toFixed(1)}%)
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateModalOpen(false)}
                className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={createCompetition}
                disabled={creating || !newCompetition.name || !newCompetition.start_date || !newCompetition.end_date}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {creating ? 'Creating...' : 'Create Competition'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total</p>
                <p className="text-2xl font-bold text-white">{statusCounts.all}</p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active</p>
                <p className="text-2xl font-bold text-green-400">{statusCounts.active}</p>
              </div>
              <Play className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Upcoming</p>
                <p className="text-2xl font-bold text-blue-400">{statusCounts.upcoming}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-gray-400">{statusCounts.completed}</p>
              </div>
              <Trophy className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Competitions Table */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="bg-gray-800">
              <TabsTrigger value="all" className="data-[state=active]:bg-gray-700">
                All ({statusCounts.all})
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-gray-700">
                Active ({statusCounts.active})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="data-[state=active]:bg-gray-700">
                Upcoming ({statusCounts.upcoming})
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-gray-700">
                Completed ({statusCounts.completed})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Competition</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Duration</TableHead>
                <TableHead className="text-gray-300">Participants</TableHead>
                <TableHead className="text-gray-300">Prize</TableHead>
                <TableHead className="text-gray-300 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getFilteredCompetitions().map((competition) => (
                <TableRow key={competition.id} className="border-gray-700 hover:bg-gray-800">
                  <TableCell>
                    <div>
                      <div className="font-medium text-white">{competition.name}</div>
                      <div className="text-sm text-gray-400 max-w-xs truncate">
                        {competition.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(competition.status)} text-white`}>
                      {competition.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="text-white">
                        {formatDate(competition.start_date)}
                      </div>
                      <div className="text-gray-400">
                        to {formatDate(competition.end_date)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="text-white">{competition.participant_count}</span>
                      {competition.max_participants && (
                        <span className="text-gray-400">/ {competition.max_participants}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-green-400" />
                      <span className="text-white font-medium">
                        {formatCurrency(competition.prize_amount)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      
                      {competition.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {getFilteredCompetitions().length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No competitions found for this filter.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}