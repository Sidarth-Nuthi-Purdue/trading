'use client';

import React, { useState, useEffect } from 'react';
import { Search, Eye, Wallet, TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import TradesModal from './trades-modal';

interface User {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  balance_info: {
    balance: number;
    available_balance: number;
    total_pnl: number;
    daily_pnl: number;
    weekly_pnl: number;
    monthly_pnl: number;
  };
  trading_stats: {
    total_trades: number;
    winning_trades: number;
    win_rate: number;
    recent_trades: any[];
  };
}

interface UsersTableProps {}

export default function UsersTable({}: UsersTableProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [tradesModalOpen, setTradesModalOpen] = useState(false);
  const [balanceAction, setBalanceAction] = useState<'add' | 'remove'>('add');
  const [balanceAmount, setBalanceAmount] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/creator/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        console.error('Failed to load users:', response.status);
        // Set empty array if no users found
        setUsers([]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBalanceAdjustment = async () => {
    if (!selectedUser || !balanceAmount) return;

    try {
      const response = await fetch('/api/creator/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUser.user_id,
          action: balanceAction,
          amount: parseFloat(balanceAmount)
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Balance updated:', result.message);
        
        // Refresh users data
        await loadUsers();
        
        // Close modal and reset form
        setBalanceModalOpen(false);
        setBalanceAmount('');
        setSelectedUser(null);
      } else {
        const error = await response.json();
        console.error('Failed to update balance:', error.error);
      }
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const openBalanceModal = (user: User, action: 'add' | 'remove') => {
    setSelectedUser(user);
    setBalanceAction(action);
    setBalanceModalOpen(true);
  };

  const openTradesModal = (user: User) => {
    setSelectedUser(user);
    setTradesModalOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <Button
          onClick={loadUsers}
          variant="outline"
          className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
        >
          Refresh
        </Button>
      </div>

      {/* Users Table */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">User</TableHead>
                <TableHead className="text-gray-300">Join Date</TableHead>
                <TableHead className="text-gray-300">Balance</TableHead>
                <TableHead className="text-gray-300">Total P&L</TableHead>
                <TableHead className="text-gray-300">Trades</TableHead>
                <TableHead className="text-gray-300">Win Rate</TableHead>
                <TableHead className="text-gray-300 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.user_id} className="border-gray-700 hover:bg-gray-800">
                  <TableCell>
                    <div>
                      <div className="font-medium text-white">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-sm text-gray-400">@{user.username}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-white">
                        {formatCurrency(user.balance_info?.balance || 0)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Available: {formatCurrency(user.balance_info?.available_balance || 0)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className={`font-medium ${
                        (user.balance_info?.total_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {(user.balance_info?.total_pnl || 0) >= 0 ? '+' : ''}
                        {formatCurrency(user.balance_info?.total_pnl || 0)}
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className={`${
                          (user.balance_info?.daily_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          Day: {(user.balance_info?.daily_pnl || 0) >= 0 ? '+' : ''}
                          {formatCurrency(user.balance_info?.daily_pnl || 0)}
                        </div>
                        <div className={`${
                          (user.balance_info?.weekly_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          Week: {(user.balance_info?.weekly_pnl || 0) >= 0 ? '+' : ''}
                          {formatCurrency(user.balance_info?.weekly_pnl || 0)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-white">
                        {user.trading_stats?.total_trades || 0}
                      </div>
                      <div className="text-xs text-gray-400">
                        {user.trading_stats?.winning_trades || 0} wins
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      (user.trading_stats?.win_rate || 0) >= 60 ? 'default' : 
                      (user.trading_stats?.win_rate || 0) >= 40 ? 'secondary' : 'destructive'
                    }>
                      {(user.trading_stats?.win_rate || 0).toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTradesModal(user)}
                        className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Trades
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                          >
                            <Wallet className="h-3 w-3 mr-1" />
                            Balance
                            <MoreHorizontal className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-gray-800 border-gray-600">
                          <DropdownMenuItem
                            onClick={() => openBalanceModal(user, 'add')}
                            className="text-green-400 hover:bg-gray-700"
                          >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Add Balance
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openBalanceModal(user, 'remove')}
                            className="text-red-400 hover:bg-gray-700"
                          >
                            <TrendingDown className="h-4 w-4 mr-2" />
                            Remove Balance
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No users found matching your search.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance Adjustment Modal */}
      <Dialog open={balanceModalOpen} onOpenChange={setBalanceModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>
              {balanceAction === 'add' ? 'Add' : 'Remove'} Balance
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedUser && (
                <>
                  User: {selectedUser.first_name} {selectedUser.last_name} (@{selectedUser.username})
                  <br />
                  Current Balance: {formatCurrency(selectedUser.balance_info?.balance || 0)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={balanceAction === 'add'}
                onCheckedChange={(checked) => setBalanceAction(checked ? 'add' : 'remove')}
              />
              <Label className="text-gray-300">
                {balanceAction === 'add' ? 'Add Balance' : 'Remove Balance'}
              </Label>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-gray-300">Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="0.00"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
            
            {/* Quick amount buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 5000].map((amount) => (
                <Button
                  key={amount}
                  size="sm"
                  variant="outline"
                  onClick={() => setBalanceAmount(amount.toString())}
                  className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBalanceModalOpen(false)}
              className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBalanceAdjustment}
              disabled={!balanceAmount || parseFloat(balanceAmount) <= 0}
              className={
                balanceAction === 'add'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {balanceAction === 'add' ? 'Add' : 'Remove'} ${balanceAmount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trades Modal */}
      <TradesModal
        user={selectedUser}
        open={tradesModalOpen}
        onOpenChange={setTradesModalOpen}
      />
    </div>
  );
}