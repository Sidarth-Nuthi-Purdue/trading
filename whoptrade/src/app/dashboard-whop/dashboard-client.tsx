'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Clock,
  Trophy,
  ChevronRight
} from 'lucide-react';
import PortfolioPerformanceChart from '@/components/portfolio-performance-chart';
import { getWhopAuthHeaders } from '@/lib/whop-supabase-bridge';

interface DashboardClientProps {
  userId: string | null;
  showAuth?: boolean;
  authError?: string;
}

interface DashboardData {
  balance: {
    balance: number;
    available_balance: number;
    total_pnl: number;
    daily_pnl: number;
    weekly_pnl: number;
    monthly_pnl: number;
  };
  positions: any[];
  portfolio_summary: {
    total_portfolio_value: number;
    total_unrealized_pnl: number;
    cash_balance: number;
    total_account_value: number;
  };
}

export default function DashboardClient({ userId, showAuth = false, authError }: DashboardClientProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (userId && !showAuth) {
      bridgeWhopToSupabase();
    } else {
      setLoading(false);
    }
  }, [userId, showAuth]);

  const bridgeWhopToSupabase = async () => {
    try {
      setIsAuthenticating(true);
      console.log('Creating Whop session...');
      
      const response = await fetch('/api/auth/whop-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      console.log('Whop session created successfully:', data.user.id);

      // Store session data for API requests
      if (data.session) {
        const authData = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          user: data.user
        };

        localStorage.setItem('supabase.auth.token', JSON.stringify(authData));
        (window as any).supabaseSession = data.session;
      }

      // Now load dashboard data with proper authentication
      loadDashboardData();

    } catch (error) {
      console.error('Error creating Whop session:', error);
      setError('Failed to authenticate user');
      setLoading(false);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load portfolio data using the existing API with proper auth headers
      const response = await fetch('/api/paper-trading/portfolio', {
        headers: getWhopAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        // If portfolio API fails, create default data
        setDashboardData({
          balance: { 
            balance: 100000, 
            available_balance: 100000, 
            total_pnl: 0, 
            daily_pnl: 0, 
            weekly_pnl: 0, 
            monthly_pnl: 0 
          },
          positions: [],
          portfolio_summary: { 
            total_portfolio_value: 0, 
            total_unrealized_pnl: 0, 
            cash_balance: 100000, 
            total_account_value: 100000 
          }
        });
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
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

  const getPnLColor = (value: number) => {
    return value >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getPnLIcon = (value: number) => {
    return value >= 0 ? 
      <TrendingUp className="w-4 h-4" /> : 
      <TrendingDown className="w-4 h-4" />;
  };

  // Show authentication fallback if not authenticated
  if (showAuth || !userId) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">WhopTrade Dashboard</h1>
              <p className="text-gray-400">Authentication Required</p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8">
          <Card className="bg-yellow-900/20 border-yellow-700 max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-yellow-400 mb-2">
                Whop Authentication Context Required
              </h2>
              <p className="text-yellow-300 mb-4">
                This dashboard requires Whop SDK authentication. The Whop SDK only works when this app is loaded within a Whop iframe context.
              </p>
              
              {authError && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-4">
                  <p className="text-red-400 text-sm">
                    <strong>Authentication Error:</strong> {authError}
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                <p className="text-gray-300 text-sm">
                  <strong>If you're accessing this directly:</strong>
                </p>
                <ul className="text-gray-400 text-sm text-left space-y-1">
                  <li>• This app is designed to work within Whop's platform</li>
                  <li>• Try accessing it through your Whop dashboard</li>
                  <li>• Or use the alternative authentication methods below</li>
                </ul>
              </div>

              <div className="flex flex-col space-y-3">
                <Button
                  onClick={() => window.location.href = '/dashboard'}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Go to Classic Dashboard
                </Button>
                <Button
                  onClick={() => window.location.href = '/login'}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Login with Email
                </Button>
                <Button
                  onClick={() => window.location.href = '/exchange'}
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  Go to Trading Exchange
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading || isAuthenticating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">
            {isAuthenticating ? 'Setting up your account...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-red-900/20 border-red-700">
            <CardContent className="p-6">
              <p className="text-red-400">{error}</p>
              <Button onClick={loadDashboardData} className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const balance = dashboardData?.balance;
  const portfolioSummary = dashboardData?.portfolio_summary;
  const positions = dashboardData?.positions || [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">WhopTrade Dashboard</h1>
            <p className="text-gray-400">Welcome back! Here's your trading overview.</p>
            <p className="text-xs text-gray-500">User ID: {userId}</p>
          </div>
          <div className="flex space-x-4">
            <Button
              onClick={() => window.location.href = '/exchange'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Start Trading
            </Button>
            <Button
              onClick={() => window.location.href = '/dashboard'}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Classic Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Account Value */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Account Value</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(portfolioSummary?.total_account_value || 0)}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Cash: {formatCurrency(balance?.available_balance || 0)}
              </p>
            </CardContent>
          </Card>

          {/* Total P&L */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total P&L</CardTitle>
              <BarChart3 className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPnLColor(balance?.total_pnl || 0)}`}>
                {balance?.total_pnl && balance.total_pnl >= 0 ? '+' : ''}{formatCurrency(balance?.total_pnl || 0)}
              </div>
              <div className={`text-xs flex items-center mt-1 ${getPnLColor(balance?.total_pnl || 0)}`}>
                {getPnLIcon(balance?.total_pnl || 0)}
                <span className="ml-1">All time</span>
              </div>
            </CardContent>
          </Card>

          {/* Daily P&L */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Daily P&L</CardTitle>
              <Clock className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPnLColor(balance?.daily_pnl || 0)}`}>
                {balance?.daily_pnl && balance.daily_pnl >= 0 ? '+' : ''}{formatCurrency(balance?.daily_pnl || 0)}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Today's performance
              </p>
            </CardContent>
          </Card>

          {/* Portfolio Value */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Portfolio Value</CardTitle>
              <Trophy className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(portfolioSummary?.total_portfolio_value || 0)}
              </div>
              <div className={`text-xs flex items-center mt-1 ${getPnLColor(portfolioSummary?.total_unrealized_pnl || 0)}`}>
                {getPnLIcon(portfolioSummary?.total_unrealized_pnl || 0)}
                <span className="ml-1">
                  {portfolioSummary?.total_unrealized_pnl && portfolioSummary.total_unrealized_pnl >= 0 ? '+' : ''}
                  {formatCurrency(portfolioSummary?.total_unrealized_pnl || 0)} unrealized
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Performance Chart */}
        <PortfolioPerformanceChart />

        {/* Positions Overview */}
        <Card className="bg-gray-900 border-gray-700 mt-8">
          <CardHeader>
            <CardTitle className="text-white">Current Positions</CardTitle>
          </CardHeader>
          <CardContent>
            {positions.length > 0 ? (
              <div className="space-y-4">
                {positions.slice(0, 5).map((position, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="font-medium text-white">{position.symbol}</div>
                        <div className="text-sm text-gray-400">
                          {position.quantity} shares @ {formatCurrency(position.average_cost)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">
                        {formatCurrency(position.current_value || 0)}
                      </div>
                      <div className={`text-sm ${getPnLColor(position.unrealized_pnl || 0)}`}>
                        {position.unrealized_pnl && position.unrealized_pnl >= 0 ? '+' : ''}
                        {formatCurrency(position.unrealized_pnl || 0)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {positions.length > 5 && (
                  <div className="text-center">
                    <Button
                      variant="ghost"
                      onClick={() => window.location.href = '/dashboard#positions'}
                      className="text-gray-400 hover:text-white"
                    >
                      View All {positions.length} Positions
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No open positions</p>
                <Button
                  onClick={() => window.location.href = '/exchange'}
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  Start Trading
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success Message */}
        <Card className="bg-green-900/20 border-green-700 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-green-400 font-medium">Whop Authentication Successful!</h3>
                <p className="text-green-300 text-sm">
                  You're now authenticated with Whop SDK. This dashboard uses proper Whop authentication 
                  and can access your portfolio data with options P&L tracking.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}