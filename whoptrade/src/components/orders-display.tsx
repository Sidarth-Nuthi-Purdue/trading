'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Order types
export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  price: number;
  quantity: number;
  status: string;
  createdAt: Date;
}

interface OrdersDisplayProps {
  orders: Order[];
  onCancelOrder: (orderId: string) => void;
  onRefreshOrders: () => void;
  isLoading?: boolean;
}

export default function OrdersDisplay({ 
  orders,
  onCancelOrder,
  onRefreshOrders,
  isLoading = false
}: OrdersDisplayProps) {
  // Format currency for display
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    }).format(date);
  };

  // Get badge variant based on order status
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'filled':
        return 'success';
      case 'open':
      case 'pending':
        return 'default';
      case 'canceled':
        return 'outline';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Orders</CardTitle>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onRefreshOrders}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-32" />
              </div>
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="rounded-md border">
            <div className="grid grid-cols-7 p-3 text-sm font-medium text-muted-foreground border-b">
              <div>Symbol</div>
              <div>Side</div>
              <div>Type</div>
              <div>Quantity</div>
              <div>Price</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="divide-y">
              {orders.map((order) => (
                <div key={order.id} className="grid grid-cols-7 p-3 text-sm">
                  <div className="font-medium">{order.symbol}</div>
                  <div>
                    <Badge variant={order.side === 'buy' ? 'default' : 'destructive'}>
                      {order.side.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="capitalize">{order.type.replace('_', ' ')}</div>
                  <div>{order.quantity}</div>
                  <div>
                    {order.type !== 'market' ? formatCurrency(order.price) : 'Market'}
                  </div>
                  <div>
                    <Badge variant={getStatusVariant(order.status)} className="capitalize">
                      {order.status.toLowerCase()}
                    </Badge>
                  </div>
                  <div className="text-right">
                    {['open', 'pending'].includes(order.status.toLowerCase()) && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onCancelOrder(order.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            No orders found
          </div>
        )}
      </CardContent>
    </Card>
  );
} 