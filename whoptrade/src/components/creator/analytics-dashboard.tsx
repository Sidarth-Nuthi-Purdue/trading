'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, DollarSign, TrendingUp, TrendingDown, Activity, Target, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface AnalyticsData {
  overview: {
    total_users: number;
    active_users: number;
    new_users: number;
    total_orders: number;
    recent_orders: number;
    total_volume: number;
    recent_volume: number;
    total_pnl: number;
    avg_pnl: number;
    engagement_rate: number;
    fill_rate: number;
  };
  chart_data: {
    label: string;
    date: string;
    users: number;
    orders: number;
    volume: number;
  }[];
  timeframe: string;
}

interface AnalyticsDashboardProps {
  onStatsUpdate: () => void;
}

export default function AnalyticsDashboard({ onStatsUpdate }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('week');

  useEffect(() => {
    loadAnalytics();
  }, [timeframe]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/creator/analytics?timeframe=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      } else {
        console.error('Failed to load analytics:', response.status);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
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

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getPercentageColor = (value: number) => {
    return value >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getTimeframeLabel = (tf: string) => {
    switch (tf) {
      case 'day': return 'Last 24 Hours';
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      case 'year': return 'Last 12 Months';
      default: return 'Last 7 Days';
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

  if (!analytics) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No analytics data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overview = analytics.overview;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Analytics Dashboard</h2>
          <p className="text-gray-400">Platform performance and user insights</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="day" className="text-white">Last 24 Hours</SelectItem>
              <SelectItem value="week" className="text-white">Last 7 Days</SelectItem>
              <SelectItem value="month" className="text-white">Last 30 Days</SelectItem>
              <SelectItem value="year" className="text-white">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            onClick={loadAnalytics}
            variant="outline"
            className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-white">{overview.total_users}</p>
                <p className="text-xs text-green-400">
                  +{overview.new_users} new {getTimeframeLabel(timeframe).toLowerCase()}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-white">{overview.active_users}</p>
                <p className="text-xs text-gray-400">
                  {overview.total_users > 0 
                    ? Math.round((overview.active_users / overview.total_users) * 100)
                    : 0}% of total
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        {/* Trading Volume */}
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Trading Volume</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(overview.total_volume)}</p>
                <p className="text-xs text-purple-400">
                  {formatCurrency(overview.recent_volume)} recent
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        {/* Engagement Rate */}
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Engagement Rate</p>
                <p className="text-2xl font-bold text-white">{overview.engagement_rate.toFixed(1)}%</p>
                <p className="text-xs text-yellow-400">
                  Users actively trading
                </p>
              </div>
              <Target className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Orders */}
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Orders</p>
                <p className="text-2xl font-bold text-white">{formatNumber(overview.total_orders)}</p>
                <p className="text-xs text-gray-400">
                  {overview.recent_orders} in {getTimeframeLabel(timeframe).toLowerCase()}
                </p>
              </div>
              <BarChart3 className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        {/* Average P&L */}
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Average P&L</p>
                <p className={`text-2xl font-bold ${getPercentageColor(overview.avg_pnl)}`}>
                  {overview.avg_pnl >= 0 ? '+' : ''}{formatCurrency(overview.avg_pnl)}
                </p>
                <p className="text-xs text-gray-400">
                  Per user
                </p>
              </div>
              {overview.avg_pnl >= 0 ? (
                <TrendingUp className="h-6 w-6 text-green-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-400" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fill Rate */}
        <Card className="bg-gray-900 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Order Fill Rate</p>
                <p className="text-2xl font-bold text-white">{overview.fill_rate.toFixed(1)}%</p>
                <p className="text-xs text-gray-400">
                  Orders successfully executed
                </p>
              </div>
              <Target className="h-6 w-6 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Data */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Activity Trends - {getTimeframeLabel(timeframe)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Simple data visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Users Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">New Users</h4>
                <div className="space-y-2">
                  {analytics.chart_data.slice(-7).map((point, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{point.label}</span>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="bg-blue-500 h-2 rounded"
                          style={{ 
                            width: `${Math.max(4, (point.users / Math.max(...analytics.chart_data.map(p => p.users))) * 60)}px` 
                          }}
                        />
                        <span className="text-xs text-white w-6">{point.users}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Orders Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Orders</h4>
                <div className="space-y-2">
                  {analytics.chart_data.slice(-7).map((point, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{point.label}</span>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="bg-green-500 h-2 rounded"
                          style={{ 
                            width: `${Math.max(4, (point.orders / Math.max(...analytics.chart_data.map(p => p.orders))) * 60)}px` 
                          }}
                        />
                        <span className="text-xs text-white w-6">{point.orders}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Volume Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Volume</h4>
                <div className="space-y-2">
                  {analytics.chart_data.slice(-7).map((point, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{point.label}</span>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="bg-purple-500 h-2 rounded"
                          style={{ 
                            width: `${Math.max(4, (point.volume / Math.max(...analytics.chart_data.map(p => p.volume))) * 60)}px` 
                          }}
                        />
                        <span className="text-xs text-white w-12">{formatCurrency(point.volume)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Health */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Platform Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{overview.engagement_rate.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">User Engagement</div>
              <div className="text-xs text-gray-500 mt-1">
                {overview.engagement_rate >= 50 ? 'Excellent' : 
                 overview.engagement_rate >= 30 ? 'Good' : 
                 overview.engagement_rate >= 15 ? 'Fair' : 'Needs Improvement'}
              </div>
            </div>

            <div className="text-center p-4 bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{overview.fill_rate.toFixed(1)}%</div>
              <div className="text-sm text-gray-400">Order Fill Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                {overview.fill_rate >= 90 ? 'Excellent' : 
                 overview.fill_rate >= 75 ? 'Good' : 
                 overview.fill_rate >= 60 ? 'Fair' : 'Needs Improvement'}
              </div>
            </div>

            <div className="text-center p-4 bg-gray-800 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">
                {overview.total_users > 0 ? (overview.active_users / overview.total_users * 100).toFixed(1) : 0}%
              </div>
              <div className="text-sm text-gray-400">Active User Rate</div>
              <div className="text-xs text-gray-500 mt-1">
                {(overview.active_users / overview.total_users * 100) >= 70 ? 'Excellent' : 
                 (overview.active_users / overview.total_users * 100) >= 50 ? 'Good' : 
                 (overview.active_users / overview.total_users * 100) >= 30 ? 'Fair' : 'Needs Improvement'}
              </div>
            </div>

            <div className="text-center p-4 bg-gray-800 rounded-lg">
              <div className={`text-2xl font-bold ${getPercentageColor(overview.total_pnl)}`}>
                {formatCurrency(overview.total_pnl)}
              </div>
              <div className="text-sm text-gray-400">Total Platform P&L</div>
              <div className="text-xs text-gray-500 mt-1">
                Aggregate user performance
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}