'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3, 
  Activity,
  Target,
  Zap
} from 'lucide-react';

interface PerformanceData {
  period: string;
  granularity: string;
  history: Array<{
    timestamp: Date;
    cashBalance: number;
    portfolioValue: number;
    totalValue: number;
    realizedPnL: number;
    unrealizedPnL: number;
    totalReturn: number;
    totalReturnPercent: number;
    positions: any[];
    ordersCount: number;
  }>;
  summary: {
    startValue: number;
    endValue: number;
    totalReturn: number;
    totalReturnPercent: number;
    realizedPnL: number;
    unrealizedPnL: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
  };
}

interface PortfolioPerformanceChartProps {
  userId?: string;
}

export default function PortfolioPerformanceChart({ userId }: PortfolioPerformanceChartProps) {
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30d');
  const [granularity, setGranularity] = useState('daily');

  useEffect(() => {
    loadPerformanceData();
  }, [period, granularity]);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        period,
        granularity
      });

      const response = await fetch(`/api/paper-trading/performance?${params}`, {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch performance data: ${response.status}`);
      }

      const data = await response.json();
      setPerformanceData(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getAccessToken = async () => {
    // This should be imported from your auth context/provider
    // For now, we'll assume it's available globally or via a hook
    if (typeof window !== 'undefined') {
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || '';
    }
    return '';
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

  const getPnLColor = (value: number) => {
    return value >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getPnLIcon = (value: number) => {
    return value >= 0 ? 
      <TrendingUp className="w-4 h-4" /> : 
      <TrendingDown className="w-4 h-4" />;
  };

  // Simple SVG chart component since we don't have recharts
  const SimpleLineChart = ({ data, width = 800, height = 300 }: any) => {
    if (!data || data.length === 0) return null;

    const minValue = Math.min(...data.map((d: any) => d.totalValue));
    const maxValue = Math.max(...data.map((d: any) => d.totalValue));
    const range = maxValue - minValue || 1; // Prevent division by zero
    const padding = 40;

    const points = data.map((d: any, i: number) => {
      const x = data.length > 1 ? (i / (data.length - 1)) * (width - 2 * padding) + padding : width / 2;
      const y = height - padding - ((d.totalValue - minValue) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');

    const isPositive = data[data.length - 1]?.totalReturn >= 0;
    const lineColor = isPositive ? '#10b981' : '#ef4444'; // green or red

    return (
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} className="w-full h-auto">
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#374151" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Chart line */}
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            points={points}
          />
          
          {/* Data points */}
          {data.map((d: any, i: number) => {
            const x = data.length > 1 ? (i / (data.length - 1)) * (width - 2 * padding) + padding : width / 2;
            const y = height - padding - ((d.totalValue - minValue) / range) * (height - 2 * padding);
            
            // Skip rendering if coordinates are invalid
            if (isNaN(x) || isNaN(y)) return null;
            
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill={lineColor}
                className="opacity-60 hover:opacity-100 transition-opacity"
              />
            );
          })}
          
          {/* Y-axis labels */}
          <text x="10" y={padding} fill="#9ca3af" fontSize="12">
            {formatCurrency(maxValue)}
          </text>
          <text x="10" y={height - padding} fill="#9ca3af" fontSize="12">
            {formatCurrency(minValue)}
          </text>
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Performance</CardTitle>
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
          <CardTitle className="text-white">Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-400">
            <p>Error loading performance data: {error}</p>
            <Button onClick={loadPerformanceData} className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!performanceData) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <p>No performance data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { history, summary } = performanceData;

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Portfolio Performance</CardTitle>
          <div className="flex items-center space-x-4">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="1d" className="text-white">1 Day</SelectItem>
                <SelectItem value="7d" className="text-white">7 Days</SelectItem>
                <SelectItem value="30d" className="text-white">30 Days</SelectItem>
                <SelectItem value="90d" className="text-white">90 Days</SelectItem>
                <SelectItem value="1y" className="text-white">1 Year</SelectItem>
                <SelectItem value="all" className="text-white">All Time</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={granularity} onValueChange={setGranularity}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="daily" className="text-white">Daily</SelectItem>
                <SelectItem value="weekly" className="text-white">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">Total Return</span>
            </div>
            <div className={`text-lg font-bold ${getPnLColor(summary.totalReturn)}`}>
              {formatCurrency(summary.totalReturn)}
            </div>
            <div className={`text-xs ${getPnLColor(summary.totalReturnPercent)}`}>
              {formatPercent(summary.totalReturnPercent)}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Realized P&L</span>
            </div>
            <div className={`text-lg font-bold ${getPnLColor(summary.realizedPnL)}`}>
              {formatCurrency(summary.realizedPnL)}
            </div>
            <div className="text-xs text-gray-400">From trades</div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Unrealized P&L</span>
            </div>
            <div className={`text-lg font-bold ${getPnLColor(summary.unrealizedPnL)}`}>
              {formatCurrency(summary.unrealizedPnL)}
            </div>
            <div className="text-xs text-gray-400">Open positions</div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400">Win Rate</span>
            </div>
            <div className="text-lg font-bold text-white">
              {summary.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">Profitable trades</div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-gray-400">Max Drawdown</span>
            </div>
            <div className="text-lg font-bold text-red-400">
              -{summary.maxDrawdown.toFixed(2)}%
            </div>
            <div className="text-xs text-gray-400">Largest loss</div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Portfolio Value Over Time</h3>
            <div className="flex items-center space-x-2">
              {getPnLIcon(summary.totalReturn)}
              <span className={`font-medium ${getPnLColor(summary.totalReturn)}`}>
                {formatCurrency(summary.endValue)}
              </span>
            </div>
          </div>
          
          <SimpleLineChart data={history} />
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Portfolio Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cash:</span>
                <span className="text-white">{formatCurrency(history[history.length - 1]?.cashBalance || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Investments:</span>
                <span className="text-white">{formatCurrency(history[history.length - 1]?.portfolioValue || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-2">
                <span className="text-gray-400 font-medium">Total:</span>
                <span className="text-white font-medium">{formatCurrency(summary.endValue)}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Performance Metrics</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Sharpe Ratio:</span>
                <span className="text-white">{summary.sharpeRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Start Value:</span>
                <span className="text-white">{formatCurrency(summary.startValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Positions:</span>
                <span className="text-white">{history[history.length - 1]?.positions?.length || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Options P&L Impact</h4>
            <div className="space-y-2 text-sm">
              <div className="text-xs text-gray-400">
                This chart includes all options trades with their real-time P&L impact:
              </div>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Options premiums paid/received</li>
                <li>• Real-time unrealized P&L</li>
                <li>• Realized gains/losses on sales</li>
                <li>• Expired options impact</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}