'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, TrendingUp, TrendingDown, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: string;
  quantity: number;
  price: number;
  filled_price?: number;
  status: string;
  realized_pnl?: number;
  created_at: string;
  filled_at?: string;
}

interface User {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
}

interface TradesModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TradesModal({ user, open, onOpenChange }: TradesModalProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    if (user && open) {
      loadUserTrades();
    }
  }, [user, open]);

  const loadUserTrades = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Since we don't have a direct endpoint for user trades by user_id from creator perspective,
      // we'll simulate this with the existing trades endpoint
      // In a real implementation, you'd create /api/paper-trading/users/[userId]/trades
      
      // For now, we'll use mock data based on the user's trading stats
      const mockTrades: Trade[] = [
        {
          id: '1',
          symbol: 'AAPL',
          side: 'buy',
          order_type: 'market',
          quantity: 10,
          price: 175.50,
          filled_price: 175.52,
          status: 'filled',
          realized_pnl: 0,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          filled_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 1000).toISOString()
        },
        {
          id: '2',
          symbol: 'AAPL',
          side: 'sell',
          order_type: 'limit',
          quantity: 10,
          price: 180.00,
          filled_price: 178.25,
          status: 'filled',
          realized_pnl: 27.30,
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          filled_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3600000).toISOString()
        },
        {
          id: '3',
          symbol: 'MSFT',
          side: 'buy',
          order_type: 'limit',
          quantity: 5,
          price: 335.00,
          status: 'pending',
          created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '4',
          symbol: 'TSLA',
          side: 'buy',
          order_type: 'market',
          quantity: 8,
          price: 245.75,
          filled_price: 246.10,
          status: 'filled',
          realized_pnl: 0,
          created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          filled_at: new Date(Date.now() - 3 * 60 * 60 * 1000 + 500).toISOString()
        }
      ];
      
      setTrades(mockTrades);
    } catch (error) {
      console.error('Error loading user trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTrades = () => {
    switch (activeTab) {
      case 'open':
        return trades.filter(trade => trade.status === 'pending' || trade.status === 'partially_filled');
      case 'closed':
        return trades.filter(trade => trade.status === 'filled' || trade.status === 'cancelled');
      default:
        return trades;
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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled':
        return 'bg-green-600';
      case 'pending':
        return 'bg-yellow-600';
      case 'cancelled':
        return 'bg-red-600';
      case 'partially_filled':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getSideColor = (side: string) => {
    return side === 'buy' ? 'text-green-400' : 'text-red-400';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              Trades - {user?.first_name} {user?.last_name} (@{user?.username})
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3 bg-gray-800">
              <TabsTrigger value="all" className="data-[state=active]:bg-gray-700">
                All Trades ({trades.length})
              </TabsTrigger>
              <TabsTrigger value="open" className="data-[state=active]:bg-gray-700">
                Open ({trades.filter(t => t.status === 'pending' || t.status === 'partially_filled').length})
              </TabsTrigger>
              <TabsTrigger value="closed" className="data-[state=active]:bg-gray-700">
                Closed ({trades.filter(t => t.status === 'filled' || t.status === 'cancelled').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700">
                        <TableHead className="text-gray-300">Date</TableHead>
                        <TableHead className="text-gray-300">Symbol</TableHead>
                        <TableHead className="text-gray-300">Side</TableHead>
                        <TableHead className="text-gray-300">Type</TableHead>
                        <TableHead className="text-gray-300">Quantity</TableHead>
                        <TableHead className="text-gray-300">Price</TableHead>
                        <TableHead className="text-gray-300">Status</TableHead>
                        <TableHead className="text-gray-300">P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredTrades().map((trade) => (
                        <TableRow key={trade.id} className="border-gray-700 hover:bg-gray-800">
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <div>
                                <div className="text-sm text-white">
                                  {formatDate(trade.created_at)}
                                </div>
                                {trade.filled_at && (
                                  <div className="text-xs text-gray-400 flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Filled: {formatDate(trade.filled_at)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-white">{trade.symbol}</span>
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center space-x-1 ${getSideColor(trade.side)}`}>
                              {trade.side === 'buy' ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              <span className="font-medium uppercase">{trade.side}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-300 capitalize">{trade.order_type}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-white">{trade.quantity}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-white">
                                {formatCurrency(trade.filled_price || trade.price)}
                              </div>
                              {trade.filled_price && trade.filled_price !== trade.price && (
                                <div className="text-xs text-gray-400">
                                  Limit: {formatCurrency(trade.price)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(trade.status)} text-white`}>
                              {trade.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {trade.realized_pnl !== undefined ? (
                              <span className={
                                trade.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                              }>
                                {trade.realized_pnl >= 0 ? '+' : ''}{formatCurrency(trade.realized_pnl)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {getFilteredTrades().length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                      No trades found for this filter.
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Summary */}
          {trades.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-800 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-gray-400">Total Trades</div>
                <div className="text-lg font-semibold text-white">{trades.length}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400">Winning Trades</div>
                <div className="text-lg font-semibold text-green-400">
                  {trades.filter(t => t.realized_pnl && t.realized_pnl > 0).length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400">Total P&L</div>
                <div className={`text-lg font-semibold ${
                  trades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) >= 0 
                    ? 'text-green-400' : 'text-red-400'
                }`}>
                  {trades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0) >= 0 ? '+' : ''}
                  {formatCurrency(trades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400">Win Rate</div>
                <div className="text-lg font-semibold text-white">
                  {trades.length > 0 
                    ? ((trades.filter(t => t.realized_pnl && t.realized_pnl > 0).length / trades.filter(t => t.realized_pnl !== undefined).length) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}