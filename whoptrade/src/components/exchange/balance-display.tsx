'use client';

import React, { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BalanceDisplayProps {
  portfolio: any;
}

export default function BalanceDisplay({ portfolio }: BalanceDisplayProps) {
  const [showBalance, setShowBalance] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day');

  if (!portfolio) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <Wallet className="w-4 h-4" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  const { balance, portfolio_summary } = portfolio;
  const totalValue = portfolio_summary?.total_account_value || balance?.balance || 0;
  const cashBalance = balance?.available_balance || 0;
  const portfolioValue = portfolio_summary?.total_portfolio_value || 0;
  
  // Get P&L based on selected period
  const getPnL = () => {
    switch (selectedPeriod) {
      case 'day':
        return balance?.daily_pnl || 0;
      case 'week':
        return balance?.weekly_pnl || 0;
      case 'month':
        return balance?.monthly_pnl || 0;
      default:
        return balance?.total_pnl || 0;
    }
  };

  const pnl = getPnL();
  const isPositive = pnl >= 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  return (
    <div className="flex items-center space-x-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="flex items-center space-x-3 hover:bg-gray-800 p-3">
            <Wallet className="w-4 h-4 text-gray-400" />
            <div className="text-right">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-white">
                  {showBalance ? formatCompactCurrency(totalValue) : '••••••'}
                </span>
              </div>
              <div className={`text-xs flex items-center space-x-1 ${
                isPositive ? 'text-green-400' : 'text-red-400'
              }`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{isPositive ? '+' : ''}{formatCompactCurrency(pnl)}</span>
              </div>
            </div>
          </Button>
        </DialogTrigger>
        
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wallet className="w-5 h-5" />
            <span>Account Balance</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total Account Value */}
          <div className="text-center p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Total Account Value</div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(totalValue)}
            </div>
          </div>

          {/* Balance Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Cash Balance</div>
              <div className="text-lg font-semibold text-green-400">
                {formatCurrency(cashBalance)}
              </div>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Portfolio Value</div>
              <div className="text-lg font-semibold text-blue-400">
                {formatCurrency(portfolioValue)}
              </div>
            </div>
          </div>

          {/* P&L Tabs */}
          <Tabs value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as any)}>
            <TabsList className="grid w-full grid-cols-3 bg-gray-800">
              <TabsTrigger value="day" className="text-xs">Day</TabsTrigger>
              <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
            </TabsList>
            
            <TabsContent value={selectedPeriod} className="mt-4">
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {selectedPeriod === 'day' ? 'Daily' : selectedPeriod === 'week' ? 'Weekly' : 'Monthly'} P&L
                  </span>
                  <div className={`flex items-center space-x-1 ${
                    isPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="font-semibold">
                      {isPositive ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                  </div>
                </div>
                
                {/* P&L Percentage */}
                <div className="mt-2 text-right">
                  <span className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{((pnl / (totalValue - pnl)) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Positions Summary */}
          {portfolio.positions && portfolio.positions.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-300">Open Positions</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {portfolio.positions.slice(0, 5).map((position: any) => (
                  <div key={position.symbol} className="flex items-center justify-between p-2 bg-gray-800 rounded text-xs">
                    <span className="font-medium">{position.symbol}</span>
                    <div className="text-right">
                      <div className="text-white">{position.quantity.toFixed(2)} shares</div>
                      <div className={position.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {position.unrealized_pnl >= 0 ? '+' : ''}{formatCurrency(position.unrealized_pnl)}
                      </div>
                    </div>
                  </div>
                ))}
                {portfolio.positions.length > 5 && (
                  <div className="text-xs text-gray-400 text-center py-1">
                    +{portfolio.positions.length - 5} more positions
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>
      
      {/* Eye toggle button - separate from dialog trigger */}
      <button
        onClick={() => setShowBalance(!showBalance)}
        className="text-gray-400 hover:text-white p-1"
      >
        {showBalance ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      </button>
    </div>
  );
}