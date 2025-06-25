'use client';

import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, AlertCircle, TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Order {
  id: string;
  symbol: string;
  asset_type: string;
  side: 'buy' | 'sell';
  order_type: string;
  quantity: number;
  price?: number;
  filled_quantity: number;
  filled_price?: number;
  status: string;
  realized_pnl?: number;
  created_at: string;
  filled_at?: string;
}

interface OrdersTableProps {
  orders: Order[];
  onOrderCancelled: () => void;
}

export default function OrdersTable({ orders, onOrderCancelled }: OrdersTableProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'filled' | 'cancelled'>('all');
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Debug: log orders when they change
  useEffect(() => {
    console.log('OrdersTable received orders:', orders);
  }, [orders]);

  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'open':
        return orders.filter(order => order.status === 'pending' || order.status === 'partially_filled');
      case 'filled':
        return orders.filter(order => order.status === 'filled');
      case 'cancelled':
        return orders.filter(order => order.status === 'cancelled');
      default:
        return orders;
    }
  };

  const getOrderCounts = () => {
    return {
      all: orders.length,
      open: orders.filter(o => o.status === 'pending' || o.status === 'partially_filled').length,
      filled: orders.filter(o => o.status === 'filled').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    };
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancelling(orderId);
    try {
      const response = await fetch(`/api/paper-trading/orders/${orderId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onOrderCancelled();
      } else {
        const error = await response.json();
        console.error('Failed to cancel order:', error.error);
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
    } finally {
      setCancelling(null);
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
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'filled':
        return <CheckCircle className="h-3 w-3 text-green-400" />;
      case 'pending':
      case 'partially_filled':
        return <Clock className="h-3 w-3 text-yellow-400" />;
      case 'cancelled':
        return <X className="h-3 w-3 text-red-400" />;
      default:
        return <AlertCircle className="h-3 w-3 text-gray-400" />;
    }
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

  const getSideColor = (side: string) => {
    return side === 'buy' ? 'text-green-400' : 'text-red-400';
  };

  const counts = getOrderCounts();
  const filteredOrders = getFilteredOrders();

  return (
    <div className="bg-gray-900 border-t border-gray-800">
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Orders</h3>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 mb-4">
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-gray-700 text-gray-300"
            >
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger 
              value="open"
              className="data-[state=active]:bg-gray-700 text-gray-300"
            >
              Open ({counts.open})
            </TabsTrigger>
            <TabsTrigger 
              value="filled"
              className="data-[state=active]:bg-gray-700 text-gray-300"
            >
              Filled ({counts.filled})
            </TabsTrigger>
            <TabsTrigger 
              value="cancelled"
              className="data-[state=active]:bg-gray-700 text-gray-300"
            >
              Cancelled ({counts.cancelled})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <div className="bg-gray-800 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Time</TableHead>
                    <TableHead className="text-gray-300">Symbol</TableHead>
                    <TableHead className="text-gray-300">Side</TableHead>
                    <TableHead className="text-gray-300">Type</TableHead>
                    <TableHead className="text-gray-300">Quantity</TableHead>
                    <TableHead className="text-gray-300">Price</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                    <TableHead className="text-gray-300">P&L</TableHead>
                    <TableHead className="text-gray-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="border-gray-700 hover:bg-gray-750">
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-white">{formatDate(order.created_at)}</div>
                          {order.filled_at && (
                            <div className="text-xs text-gray-400">
                              Filled: {formatDate(order.filled_at)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <span className="font-medium text-white">{order.symbol}</span>
                      </TableCell>
                      
                      <TableCell>
                        <div className={`flex items-center space-x-1 ${getSideColor(order.side)}`}>
                          {order.side === 'buy' ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="font-medium uppercase text-xs">{order.side}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <span className="text-sm text-gray-300 capitalize">{order.order_type}</span>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-white">{order.quantity}</div>
                          {order.filled_quantity > 0 && order.filled_quantity < order.quantity && (
                            <div className="text-xs text-blue-400">
                              Filled: {order.filled_quantity}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {order.filled_price ? (
                            <>
                              <div className="text-white">{formatCurrency(order.filled_price)}</div>
                              {order.price && order.filled_price !== order.price && (
                                <div className="text-xs text-gray-400">
                                  Limit: {formatCurrency(order.price)}
                                </div>
                              )}
                            </>
                          ) : order.price ? (
                            <div className="text-white">{formatCurrency(order.price)}</div>
                          ) : (
                            <div className="text-gray-400">Market</div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(order.status)}
                          <Badge className={`${getStatusColor(order.status)} text-white text-xs`}>
                            {order.status}
                          </Badge>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {order.realized_pnl !== undefined && order.realized_pnl !== null ? (
                          <span className={
                            order.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                          }>
                            {order.realized_pnl >= 0 ? '+' : ''}{formatCurrency(order.realized_pnl)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      
                      <TableCell className="text-right">
                        {(order.status === 'pending' || order.status === 'partially_filled') && (
                          <AlertDialog>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-400 hover:text-white hover:bg-gray-700"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-gray-800 border-gray-600">
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-red-400 hover:bg-gray-700 cursor-pointer">
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel Order
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            
                            <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  Are you sure you want to cancel this {order.side} order for {order.quantity} shares of {order.symbol}?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700">
                                  Keep Order
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancelOrder(order.id)}
                                  disabled={cancelling === order.id}
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                  {cancelling === order.id ? 'Cancelling...' : 'Cancel Order'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredOrders.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  <div className="mb-2">
                    {activeTab === 'all' ? (
                      'No orders found'
                    ) : (
                      `No ${activeTab} orders found`
                    )}
                  </div>
                  <div className="text-sm">
                    {activeTab === 'all' && 'Place your first order to get started'}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}