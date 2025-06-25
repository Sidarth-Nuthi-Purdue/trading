'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  ArrowUp, 
  ArrowDown,
  TrendingUp, 
  TrendingDown,
  Clock,
  Filter,
  Download,
  Calendar,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataPagination } from '@/components/ui/data-pagination';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Order {
  id: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  price?: number;
  filled_price?: number;
  filled_quantity: number;
  status: string;
  realized_pnl?: number;
  created_at: string;
  filled_at?: string;
  asset_type: string;
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'filled' | 'pending' | 'cancelled'>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState({
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
      await loadOrderHistory(1, itemsPerPage);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const loadOrderHistory = async (page: number = currentPage, limit: number = itemsPerPage, status?: string, symbol?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (status && status !== 'all') {
        params.append('status', status);
      }
      
      if (symbol) {
        params.append('symbol', symbol);
      }
      
      const response = await fetch(`/api/paper-trading/orders?${params.toString()}`, { headers });
      if (response.ok) {
        const data = await response.json();
        console.log('Order history loaded:', data.orders);
        setOrders(data.orders || []);
        setFilteredOrders(data.orders || []);
        
        if (data.pagination) {
          setPagination({
            total: data.pagination.total,
            totalPages: data.pagination.totalPages
          });
        }
      } else {
        console.error('Failed to load order history:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading order history:', error);
    }
  };

  // Load orders when filters change
  useEffect(() => {
    if (user) {
      const status = activeTab === 'all' ? undefined : activeTab;
      const symbol = searchTerm || undefined;
      loadOrderHistory(1, itemsPerPage, status, symbol);
      setCurrentPage(1); // Reset to first page when filters change
    }
  }, [activeTab, searchTerm, sideFilter, itemsPerPage, user]);

  // Load orders when page changes
  useEffect(() => {
    if (user && currentPage > 1) {
      const status = activeTab === 'all' ? undefined : activeTab;
      const symbol = searchTerm || undefined;
      loadOrderHistory(currentPage, itemsPerPage, status, symbol);
    }
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (perPage: number) => {
    setItemsPerPage(perPage);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Apply client-side filtering for sideFilter only (since it's not handled server-side)
  useEffect(() => {
    let filtered = orders;

    // Filter by side (client-side only)
    if (sideFilter !== 'all') {
      filtered = filtered.filter(order => order.side === sideFilter);
    }

    setFilteredOrders(filtered);
  }, [orders, sideFilter]);

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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPnLColor = (value: number) => {
    return value >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filled':
        return 'bg-green-600';
      case 'pending':
        return 'bg-yellow-600';
      case 'partially_filled':
        return 'bg-blue-600';
      case 'cancelled':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getOrderCounts = () => {
    // Use pagination total for accurate counts, fallback to current page data
    return {
      all: pagination.total || orders.length,
      filled: orders.filter(o => o.status === 'filled').length,
      pending: orders.filter(o => o.status === 'pending' || o.status === 'partially_filled').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    };
  };

  const calculateTotalVolume = () => {
    return filteredOrders.reduce((total, order) => {
      if (order.status === 'filled' && order.filled_price) {
        return total + (order.filled_quantity * order.filled_price);
      }
      return total;
    }, 0);
  };

  const calculateTotalPnL = () => {
    return filteredOrders.reduce((total, order) => {
      return total + (order.realized_pnl || 0);
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const counts = getOrderCounts();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Trading History</h1>
            <p className="text-gray-400">Complete record of your trading activity</p>
          </div>
          <div className="flex space-x-4">
            <Button
              onClick={() => router.push('/exchange')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Start Trading
            </Button>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Orders</CardTitle>
              <Clock className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{counts.all}</div>
              <p className="text-xs text-gray-400 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Volume</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{formatCurrency(calculateTotalVolume())}</div>
              <p className="text-xs text-gray-400 mt-1">Traded value</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total P&L</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getPnLColor(calculateTotalPnL())}`}>
                {calculateTotalPnL() >= 0 ? '+' : ''}{formatCurrency(calculateTotalPnL())}
              </div>
              <p className="text-xs text-gray-400 mt-1">Realized gains/losses</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Fill Rate</CardTitle>
              <Calendar className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {counts.all > 0 ? Math.round((counts.filled / counts.all) * 100) : 0}%
              </div>
              <p className="text-xs text-gray-400 mt-1">{counts.filled} of {counts.all} filled</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-gray-900 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search by symbol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                />
              </div>

              <Select value={sideFilter} onValueChange={setSideFilter}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Filter by side" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all" className="text-white">All Sides</SelectItem>
                  <SelectItem value="buy" className="text-white">Buy Orders</SelectItem>
                  <SelectItem value="sell" className="text-white">Sell Orders</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => {
                  setSearchTerm('');
                  setSideFilter('all');
                  setActiveTab('all');
                }}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Order History</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
              <TabsList className="grid w-full grid-cols-4 bg-gray-800 mb-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-gray-700">
                  All ({counts.all})
                </TabsTrigger>
                <TabsTrigger value="filled" className="data-[state=active]:bg-gray-700">
                  Filled ({counts.filled})
                </TabsTrigger>
                <TabsTrigger value="pending" className="data-[state=active]:bg-gray-700">
                  Pending ({counts.pending})
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="data-[state=active]:bg-gray-700">
                  Cancelled ({counts.cancelled})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {filteredOrders.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left py-3 text-gray-400">Date/Time</th>
                            <th className="text-left py-3 text-gray-400">Symbol</th>
                            <th className="text-left py-3 text-gray-400">Side</th>
                            <th className="text-left py-3 text-gray-400">Type</th>
                            <th className="text-left py-3 text-gray-400">Quantity</th>
                            <th className="text-left py-3 text-gray-400">Price</th>
                            <th className="text-left py-3 text-gray-400">Value</th>
                            <th className="text-left py-3 text-gray-400">Status</th>
                            <th className="text-left py-3 text-gray-400">P&L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map((order) => (
                            <tr key={order.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                              <td className="py-3 text-gray-300 text-sm">
                                <div>{formatDate(order.created_at)}</div>
                                {order.filled_at && order.status === 'filled' && (
                                  <div className="text-xs text-gray-500">
                                    Filled: {formatDate(order.filled_at)}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 font-medium text-white">{order.symbol}</td>
                              <td className="py-3">
                                <div className={`flex items-center space-x-1 ${
                                  order.side === 'buy' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {order.side === 'buy' ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  )}
                                  <span className="font-medium uppercase text-xs">{order.side}</span>
                                </div>
                              </td>
                              <td className="py-3 text-gray-300 capitalize">{order.order_type}</td>
                              <td className="py-3 text-gray-300">
                                <div>{order.quantity}</div>
                                {order.filled_quantity > 0 && order.filled_quantity < order.quantity && (
                                  <div className="text-xs text-blue-400">
                                    Filled: {order.filled_quantity}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 text-gray-300">
                                <div>
                                  {order.filled_price ? 
                                    formatCurrency(order.filled_price) : 
                                    order.price ? 
                                      formatCurrency(order.price) : 
                                      'Market'
                                  }
                                </div>
                              </td>
                              <td className="py-3 text-gray-300">
                                {order.filled_price && order.filled_quantity ? 
                                  formatCurrency(order.filled_price * order.filled_quantity) :
                                  order.price ? 
                                    formatCurrency(order.price * order.quantity) :
                                    '--'
                                }
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
                      currentPage={currentPage}
                      totalPages={pagination.totalPages}
                      totalItems={pagination.total}
                      itemsPerPage={itemsPerPage}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      showSizeChanger={true}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">No orders found</p>
                    <p className="text-sm">
                      {activeTab === 'all' ? 
                        'Start trading to see your order history' :
                        `No ${activeTab} orders match your current filters`
                      }
                    </p>
                    {(searchTerm || sideFilter !== 'all') && (
                      <Button
                        onClick={() => {
                          setSearchTerm('');
                          setSideFilter('all');
                        }}
                        variant="outline"
                        className="mt-4 border-gray-600 text-gray-300 hover:bg-gray-800"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}