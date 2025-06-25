'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, Loader2, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface Order {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  qty: string;
  filled_qty: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  filled_avg_price: string | null;
  status: string;
  extended_hours: boolean;
  legs: any[] | null;
}

export default function OrderList() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch orders
  const fetchOrders = async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      setError(null);
      
      const response = await fetch('/api/trading/orders');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Sort orders by time (newest first)
      const sortedOrders = Array.isArray(data.orders) 
        ? [...data.orders].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        : [];
      
      setOrders(sortedOrders);
      setLastUpdated(new Date());
      
      if (!showLoadingState) {
        toast.success('Orders updated');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
      
      if (!showLoadingState) {
        toast.error('Failed to update orders');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Cancel an order
  const cancelOrder = async (orderId: string) => {
    try {
      setIsCancelling(true);
      
      const response = await fetch(`/api/trading/orders/${orderId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to cancel order: ${response.statusText}`);
      }
      
      toast.success('Order cancelled successfully');
      
      // Refresh orders after cancellation
      fetchOrders(false);
    } catch (err) {
      console.error('Error cancelling order:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
      setCancelOrderId(null);
    }
  };

  // Fetch orders on mount
  useEffect(() => {
    fetchOrders();
    
    // Set up refresh interval
    const interval = setInterval(() => {
      fetchOrders(false);
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Handle manual refresh
  const handleRefresh = () => {
    fetchOrders(false);
  };

  // Format currency value
  const formatCurrency = (value: string | number | null): string => {
    if (value === null) return '-';
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  // Format date
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'filled':
        return 'success';
      case 'partially_filled':
        return 'success';
      case 'new':
      case 'accepted':
      case 'pending_new':
        return 'default';
      case 'canceled':
      case 'expired':
        return 'secondary';
      case 'rejected':
      case 'suspended':
      case 'pending_cancel':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Handle click on symbol to navigate to trading view
  const handleSymbolClick = (symbol: string) => {
    router.push(`/dashboard/trading?symbol=${symbol}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p className="text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <p className="text-red-500 mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={() => fetchOrders()}>
          Try Again
        </Button>
      </div>
    );
  }

  // No orders state
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <p className="text-muted-foreground mb-2">No orders found</p>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {lastUpdated && (
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const isCancelable = ['new', 'accepted', 'partially_filled'].includes(order.status.toLowerCase());
              
              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto font-medium" 
                      onClick={() => handleSymbolClick(order.symbol)}
                    >
                      {order.symbol}
                    </Button>
                  </TableCell>
                  <TableCell className={order.side === 'buy' ? 'text-green-500' : 'text-red-500'}>
                    {order.side.toUpperCase()}
                  </TableCell>
                  <TableCell>
                    {order.type === 'limit' 
                      ? `Limit ${order.time_in_force}` 
                      : order.type === 'stop' 
                        ? `Stop ${order.time_in_force}` 
                        : `Market ${order.time_in_force}`}
                  </TableCell>
                  <TableCell className="text-right">
                    {parseFloat(order.qty).toFixed(2)}
                    {order.filled_qty && parseFloat(order.filled_qty) > 0 && (
                      <span className="text-muted-foreground ml-1">
                        ({parseFloat(order.filled_qty).toFixed(2)} filled)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.type === 'limit' 
                      ? formatCurrency(order.limit_price) 
                      : order.type === 'stop' 
                        ? formatCurrency(order.stop_price) 
                        : 'Market'}
                    {order.filled_avg_price && (
                      <div className="text-xs text-muted-foreground">
                        Filled: {formatCurrency(order.filled_avg_price)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(order.status) as any}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDate(order.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => router.push(`/dashboard/trading/orders/${order.id}`)}
                        title="View Details"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      
                      {isCancelable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setCancelOrderId(order.id)}
                          disabled={isCancelling}
                          title="Cancel Order"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      {/* Cancel Order Confirmation Dialog */}
      <AlertDialog open={!!cancelOrderId} onOpenChange={(open) => !open && setCancelOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelOrderId && cancelOrder(cancelOrderId)}
              disabled={isCancelling}
              className="bg-red-500 hover:bg-red-600"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, cancel order"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 