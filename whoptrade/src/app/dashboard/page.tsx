'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ArrowUp, 
  ArrowDown,
  TrendingUp, 
  TrendingDown,
  Eye,
  DollarSign,
  BarChart3,
  Clock,
  Users,
  Trophy,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataPagination } from '@/components/ui/data-pagination';
import PortfolioPerformanceChart from '@/components/portfolio-performance-chart';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

interface Order {
  id: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  price?: number;
  filled_price?: number;
  status: string;
  realized_pnl?: number;
  created_at: string;
  filled_at?: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'orders'>('overview');
  
  // Pagination state for orders
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(10);
  const [ordersPagination, setOrdersPagination] = useState({
    total: 0,
    totalPages: 0
  });
  
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);
      await loadDashboardData();
      await loadRecentOrders(1, ordersPerPage); // Load first page
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const loadDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch('/api/paper-trading/portfolio', { headers });
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        console.error('Failed to load dashboard data:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadRecentOrders = async (page: number = ordersPage, limit: number = ordersPerPage) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/paper-trading/orders?page=${page}&limit=${limit}`, { headers });
      if (response.ok) {
        const data = await response.json();
        console.log('Dashboard orders loaded:', data.orders);
        setRecentOrders(data.orders || []);
        
        if (data.pagination) {
          setOrdersPagination({
            total: data.pagination.total,
            totalPages: data.pagination.totalPages
          });
        }
      } else {
        console.error('Failed to load recent orders:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Orders error details:', errorText);
      }
    } catch (error) {
      console.error('Error loading recent orders:', error);
    }
  };

  // Load orders when page or per page changes
  useEffect(() => {
    if (user) {
      loadRecentOrders(ordersPage, ordersPerPage);
    }
  }, [ordersPage, ordersPerPage, user]);

  const handleOrdersPageChange = (page: number) => {
    setOrdersPage(page);
  };

  const handleOrdersPerPageChange = (perPage: number) => {
    setOrdersPerPage(perPage);
    setOrdersPage(1); // Reset to first page when changing page size
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

  const getPnLColor = (value: number) => {
    return value >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getPnLIcon = (value: number) => {
    return value >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled':
        return 'bg-green-600';
      case 'pending':
        return 'bg-yellow-600';
      case 'cancelled':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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
            <h1 className="text-2xl font-bold text-white">Trading Dashboard</h1>
            <p className="text-gray-400">Overview of your paper trading performance</p>
          </div>
          <div className="flex space-x-4">
            <Button
              onClick={() => router.push('/exchange')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Start Trading
            </Button>
            <Button
              onClick={() => router.push('/leaderboard')}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              View Leaderboard
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

        {/* P&L Breakdown */}
        <Card className="bg-gray-900 border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">P&L Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Weekly P&L */}
              <div className="text-center p-4 bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">Weekly P&L</div>
                <div className={`text-xl font-bold ${getPnLColor(balance?.weekly_pnl || 0)}`}>
                  {balance?.weekly_pnl && balance.weekly_pnl >= 0 ? '+' : ''}{formatCurrency(balance?.weekly_pnl || 0)}
                </div>
                <div className={`text-xs flex items-center justify-center mt-1 ${getPnLColor(balance?.weekly_pnl || 0)}`}>
                  {getPnLIcon(balance?.weekly_pnl || 0)}
                  <span className="ml-1">Last 7 days</span>
                </div>
              </div>

              {/* Monthly P&L */}
              <div className="text-center p-4 bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">Monthly P&L</div>
                <div className={`text-xl font-bold ${getPnLColor(balance?.monthly_pnl || 0)}`}>
                  {balance?.monthly_pnl && balance.monthly_pnl >= 0 ? '+' : ''}{formatCurrency(balance?.monthly_pnl || 0)}
                </div>
                <div className={`text-xs flex items-center justify-center mt-1 ${getPnLColor(balance?.monthly_pnl || 0)}`}>
                  {getPnLIcon(balance?.monthly_pnl || 0)}
                  <span className="ml-1">Last 30 days</span>
                </div>
              </div>

              {/* Balance */}
              <div className="text-center p-4 bg-gray-800 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">Available Balance</div>
                <div className="text-xl font-bold text-white">
                  {formatCurrency(balance?.available_balance || 0)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Ready to trade
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Performance Chart */}
        <PortfolioPerformanceChart />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3 bg-gray-800 mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gray-700">
              Overview
            </TabsTrigger>
            <TabsTrigger value="positions" className="data-[state=active]:bg-gray-700">
              Positions ({positions.length})
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-gray-700">
              Recent Orders
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-white">Recent Trading Activity</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('orders')}
                    className="text-gray-400 hover:text-white"
                  >
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {recentOrders.length > 0 ? (
                    <div className="space-y-3">
                      {recentOrders.slice(0, 5).map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-full ${
                              order.side === 'buy' ? 'bg-green-600/20' : 'bg-red-600/20'
                            }`}>
                              {order.side === 'buy' ? (
                                <ArrowUp className="h-4 w-4 text-green-400" />
                              ) : (
                                <ArrowDown className="h-4 w-4 text-red-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-white">{order.symbol}</div>
                              <div className="text-sm text-gray-400">
                                {order.side.toUpperCase()} {order.quantity} @ {formatCurrency(order.filled_price || order.price || 0)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={`${getStatusColor(order.status)} text-white`}>
                              {order.status}
                            </Badge>
                            <div className="text-xs text-gray-400 mt-1">
                              {formatDate(order.created_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trading activity yet</p>
                      <p className="text-sm">Start trading to see your activity here</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => router.push('/exchange')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Start Trading
                  </Button>
                  
                  <Button
                    onClick={() => router.push('/leaderboard')}
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    View Leaderboard
                  </Button>

                  <Button
                    onClick={() => setActiveTab('positions')}
                    variant="outline"
                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Portfolio
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Current Positions</CardTitle>
              </CardHeader>
              <CardContent>
                {positions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 text-gray-400">Symbol</th>
                          <th className="text-left py-3 text-gray-400">Quantity</th>
                          <th className="text-left py-3 text-gray-400">Avg Cost</th>
                          <th className="text-left py-3 text-gray-400">Current Price</th>
                          <th className="text-left py-3 text-gray-400">Current Value</th>
                          <th className="text-left py-3 text-gray-400">Unrealized P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((position, index) => (
                          <tr key={index} className="border-b border-gray-800">
                            <td className="py-3 font-medium text-white">{position.symbol}</td>
                            <td className="py-3 text-gray-300">{position.quantity}</td>
                            <td className="py-3 text-gray-300">{formatCurrency(position.average_cost)}</td>
                            <td className="py-3 text-gray-300">{formatCurrency(position.current_price)}</td>
                            <td className="py-3 text-gray-300">{formatCurrency(position.current_value)}</td>
                            <td className={`py-3 font-medium ${getPnLColor(position.unrealized_pnl)}`}>
                              {position.unrealized_pnl >= 0 ? '+' : ''}{formatCurrency(position.unrealized_pnl)}
                              <div className="text-xs">
                                ({position.unrealized_pnl_percentage >= 0 ? '+' : ''}{position.unrealized_pnl_percentage?.toFixed(2)}%)
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No positions held</p>
                    <p className="text-sm">Start trading to build your portfolio</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {recentOrders.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left py-3 text-gray-400">Date</th>
                            <th className="text-left py-3 text-gray-400">Symbol</th>
                            <th className="text-left py-3 text-gray-400">Side</th>
                            <th className="text-left py-3 text-gray-400">Type</th>
                            <th className="text-left py-3 text-gray-400">Quantity</th>
                            <th className="text-left py-3 text-gray-400">Price</th>
                            <th className="text-left py-3 text-gray-400">Status</th>
                            <th className="text-left py-3 text-gray-400">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentOrders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-800">
                              <td className="py-3 text-gray-300 text-sm">{formatDate(order.created_at)}</td>
                              <td className="py-3 font-medium text-white">{order.symbol}</td>
                              <td className={`py-3 font-medium ${
                                order.side === 'buy' ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {order.side.toUpperCase()}
                              </td>
                              <td className="py-3 text-gray-300 capitalize">{order.order_type}</td>
                              <td className="py-3 text-gray-300">{order.quantity}</td>
                              <td className="py-3 text-gray-300">
                                {formatCurrency(order.filled_price || order.price || 0)}
                              </td>
                              <td className="py-3">
                                <Badge className={`${getStatusColor(order.status)} text-white`}>
                                  {order.status}
                                </Badge>
                              </td>
                              <td className={`py-3 font-medium ${
                                order.realized_pnl ? getPnLColor(order.realized_pnl) : 'text-gray-400'
                              }`}>
                                {order.realized_pnl ? (
                                  `${order.realized_pnl >= 0 ? '+' : ''}${formatCurrency(order.realized_pnl)}`
                                ) : (
                                  '--'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination */}
                    <DataPagination
                      currentPage={ordersPage}
                      totalPages={ordersPagination.totalPages}
                      totalItems={ordersPagination.total}
                      itemsPerPage={ordersPerPage}
                      onPageChange={handleOrdersPageChange}
                      onItemsPerPageChange={handleOrdersPerPageChange}
                      showSizeChanger={true}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No orders yet</p>
                    <p className="text-sm">Your trading history will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}