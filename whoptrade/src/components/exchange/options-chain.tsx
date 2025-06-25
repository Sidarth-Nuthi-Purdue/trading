'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';

interface OptionsChainProps {
  symbol: string;
  underlyingPrice: number;
  onOptionSelect: (contract: any) => void;
}

interface OptionContract {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
  change: number;
  percentChange: number;
}

interface OptionsData {
  symbol: string;
  underlyingPrice: number;
  expirationDates: Array<{
    timestamp: number;
    date: string;
    daysToExpiry: number;
  }>;
  strikes: number[];
  options: {
    calls: OptionContract[];
    puts: OptionContract[];
  };
}

export default function OptionsChain({ symbol, underlyingPrice, onOptionSelect }: OptionsChainProps) {
  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedExpiration, setSelectedExpiration] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (symbol) {
      loadOptionsChain();
    }
  }, [symbol]);

  useEffect(() => {
    if (selectedExpiration && optionsData) {
      loadOptionsForExpiration(selectedExpiration);
    }
  }, [selectedExpiration]);

  const loadOptionsChain = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/market-data/options?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch options: ${response.status}`);
      }
      
      const data = await response.json();
      setOptionsData(data);
      
      // Auto-select first expiration
      if (data.expirationDates && data.expirationDates.length > 0) {
        setSelectedExpiration(data.expirationDates[0].timestamp.toString());
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading options chain:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOptionsForExpiration = async (timestamp: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/market-data/options?symbol=${symbol}&date=${new Date(parseInt(timestamp) * 1000).toISOString().split('T')[0]}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch options: ${response.status}`);
      }
      
      const data = await response.json();
      setOptionsData(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading options for expiration:', err);
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

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getMoneyness = (strike: number, isCall: boolean) => {
    if (isCall) {
      if (underlyingPrice > strike) return 'ITM'; // In the money
      if (underlyingPrice === strike) return 'ATM'; // At the money
      return 'OTM'; // Out of the money
    } else {
      if (underlyingPrice < strike) return 'ITM';
      if (underlyingPrice === strike) return 'ATM';
      return 'OTM';
    }
  };

  const getMoneynessColor = (moneyness: string) => {
    switch (moneyness) {
      case 'ITM': return 'bg-green-600';
      case 'ATM': return 'bg-yellow-600';
      case 'OTM': return 'bg-gray-600';
      default: return 'bg-gray-600';
    }
  };

  if (loading && !optionsData) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Options Chain</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Options Chain</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-400">
            <p>Error loading options: {error}</p>
            <Button onClick={loadOptionsChain} className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!optionsData) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Options Chain</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <p>No options data available for {symbol}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <span>Options Chain - {symbol}</span>
          <div className="flex items-center space-x-2 text-sm">
            <DollarSign className="w-4 h-4" />
            <span>{formatCurrency(underlyingPrice)}</span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Expiration Selector */}
        <div className="flex items-center space-x-4">
          <label className="text-gray-300 text-sm">Expiration:</label>
          <Select value={selectedExpiration} onValueChange={setSelectedExpiration}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-48">
              <SelectValue placeholder="Select expiration" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {optionsData.expirationDates.map((exp) => (
                <SelectItem key={exp.timestamp} value={exp.timestamp.toString()} className="text-white">
                  {exp.date} ({exp.daysToExpiry}d)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Options Table */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 text-gray-400">Calls</th>
                  <th className="text-left py-2 text-gray-400">Bid/Ask</th>
                  <th className="text-left py-2 text-gray-400">Vol</th>
                  <th className="text-center py-2 text-gray-400">Strike</th>
                  <th className="text-right py-2 text-gray-400">Vol</th>
                  <th className="text-right py-2 text-gray-400">Bid/Ask</th>
                  <th className="text-right py-2 text-gray-400">Puts</th>
                </tr>
              </thead>
              <tbody>
                {optionsData.strikes.map((strike) => {
                  const call = optionsData.options.calls.find(c => c.strike === strike);
                  const put = optionsData.options.puts.find(p => p.strike === strike);
                  
                  return (
                    <tr key={strike} className="border-b border-gray-800 hover:bg-gray-800/50">
                      {/* Call Side */}
                      <td className="py-2">
                        {call ? (
                          <button
                            onClick={() => onOptionSelect(call)}
                            className="text-left hover:bg-gray-700 p-1 rounded w-full"
                          >
                            <div className="flex items-center space-x-2">
                              <span className={getChangeColor(call.change)}>
                                {formatCurrency(call.lastPrice)}
                              </span>
                              <Badge className={`${getMoneynessColor(getMoneyness(strike, true))} text-white text-xs`}>
                                {getMoneyness(strike, true)}
                              </Badge>
                            </div>
                            <div className={`text-xs ${getChangeColor(call.change)}`}>
                              {formatPercent(call.percentChange)}
                            </div>
                          </button>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      
                      <td className="py-2 text-gray-300">
                        {call ? `${call.bid.toFixed(2)}/${call.ask.toFixed(2)}` : '-'}
                      </td>
                      
                      <td className="py-2 text-gray-300">
                        {call ? call.volume.toLocaleString() : '-'}
                      </td>
                      
                      {/* Strike Price */}
                      <td className="py-2 text-center font-medium text-white">
                        {formatCurrency(strike)}
                      </td>
                      
                      {/* Put Side */}
                      <td className="py-2 text-right text-gray-300">
                        {put ? put.volume.toLocaleString() : '-'}
                      </td>
                      
                      <td className="py-2 text-right text-gray-300">
                        {put ? `${put.bid.toFixed(2)}/${put.ask.toFixed(2)}` : '-'}
                      </td>
                      
                      <td className="py-2 text-right">
                        {put ? (
                          <button
                            onClick={() => onOptionSelect(put)}
                            className="text-right hover:bg-gray-700 p-1 rounded w-full"
                          >
                            <div className="flex items-center justify-end space-x-2">
                              <Badge className={`${getMoneynessColor(getMoneyness(strike, false))} text-white text-xs`}>
                                {getMoneyness(strike, false)}
                              </Badge>
                              <span className={getChangeColor(put.change)}>
                                {formatCurrency(put.lastPrice)}
                              </span>
                            </div>
                            <div className={`text-xs ${getChangeColor(put.change)}`}>
                              {formatPercent(put.percentChange)}
                            </div>
                          </button>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}