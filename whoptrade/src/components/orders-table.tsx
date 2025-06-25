import React, { useState } from 'react';
import { Order, Trade } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ClockIcon, RefreshCwIcon, SearchIcon } from 'lucide-react';

interface OrdersTableProps {
  orders: Order[];
  closedTrades?: Trade[];
  onCancelOrder?: (orderId: string) => Promise<void>;
  onClosePosition?: (symbol: string) => Promise<void>;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function OrdersTable({
  orders,
  closedTrades = [],
  onCancelOrder,
  onClosePosition,
  isLoading = false,
  onRefresh
}: OrdersTableProps) {
  const [selectedTab, setSelectedTab] = useState('open');
  const [searchTerm, setSearchTerm] = useState('');
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [closingPositionSymbol, setClosingPositionSymbol] = useState<string | null>(null);
  
  // Filter orders based on status and search term
  const openOrders = orders.filter(order => 
    (order.status === 'new' || order.status === 'partially_filled') &&
    (order.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const pendingOrders = orders.filter(order => 
    (order.status === 'pending') &&
    (order.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const filteredClosedTrades = closedTrades.filter(trade => 
    trade.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Format currency safely
  const formatCurrency = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null) return 'N/A';
    
    let numericValue: number;
    
    if (typeof value === 'string') {
      numericValue = parseFloat(value);
      if (isNaN(numericValue)) return 'N/A';
    } else if (typeof value === 'number') {
      numericValue = value;
    } else {
      return 'N/A';
    }
    
    return numericValue.toFixed(2);
  };
  
  // Format quantity safely
  const formatQuantity = (qty: string | number | undefined | null): string => {
    if (qty === undefined || qty === null) return '0';
    
    let numericValue: number;
    
    if (typeof qty === 'string') {
      numericValue = parseFloat(qty);
      if (isNaN(numericValue)) return '0';
    } else if (typeof qty === 'number') {
      numericValue = qty;
    } else {
      return '0';
    }
    
    return numericValue.toLocaleString();
  };
  
  // Handle canceling an order
  const handleCancelOrder = async (orderId: string) => {
    if (onCancelOrder) {
      setCancelingOrderId(orderId);
      try {
        await onCancelOrder(orderId);
      } catch (error) {
        console.error('Failed to cancel order:', error);
      } finally {
        setCancelingOrderId(null);
      }
    }
  };
  
  // Handle closing a position
  const handleClosePosition = async (symbol: string) => {
    if (onClosePosition) {
      setClosingPositionSymbol(symbol);
      try {
        await onClosePosition(symbol);
      } catch (error) {
        console.error('Failed to close position:', error);
      } finally {
        setClosingPositionSymbol(null);
      }
    }
  };

  return (
    <div className="w-full flex flex-col rounded-md border border-border overflow-hidden">
      {/* Header with search and refresh */}
      <div className="bg-muted/40 p-2 border-b border-border flex items-center justify-between">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCwIcon className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
      
      {/* Tabs for different order types */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="bg-muted/40 border-b border-border rounded-none w-full justify-start h-10">
          <TabsTrigger 
            value="open"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Open Orders ({openOrders.length})
          </TabsTrigger>
          <TabsTrigger 
            value="pending"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Pending Orders ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger 
            value="closed"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Closed Trades ({filteredClosedTrades.length})
          </TabsTrigger>
        </TabsList>
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-center items-center p-6">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Open Orders Table */}
        <TabsContent value="open" className={isLoading ? 'hidden' : ''}>
          {openOrders.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No open orders found
              {searchTerm && ` for "${searchTerm}"`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Filled</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={order.side === 'buy' ? 'default' : 'destructive'}>
                          {order.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.type}</TableCell>
                      <TableCell>{formatQuantity(order.qty)}</TableCell>
                      <TableCell>{formatQuantity(order.filled_qty)}</TableCell>
                      <TableCell>
                        {order.limit_price ? `$${formatCurrency(order.limit_price)}` : 'Market'}
                      </TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {order.status === 'new' ? 'Open' : order.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancelingOrderId === order.id}
                            >
                              {cancelingOrderId === order.id ? 'Cancelling...' : 'Cancel'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this {order.side} order for {order.qty} {order.symbol}?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelOrder(order.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Confirm Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        
        {/* Pending Orders Table */}
        <TabsContent value="pending" className={isLoading ? 'hidden' : ''}>
          {pendingOrders.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No pending orders found
              {searchTerm && ` for "${searchTerm}"`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={order.side === 'buy' ? 'default' : 'destructive'}>
                          {order.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.type}</TableCell>
                      <TableCell>{formatQuantity(order.qty)}</TableCell>
                      <TableCell>
                        {order.limit_price ? `$${formatCurrency(order.limit_price)}` : 'Market'}
                      </TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancelingOrderId === order.id}
                            >
                              {cancelingOrderId === order.id ? 'Cancelling...' : 'Cancel'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this {order.side} order for {order.qty} {order.symbol}?
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelOrder(order.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Confirm Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        
        {/* Closed Trades Table */}
        <TabsContent value="closed" className={isLoading ? 'hidden' : ''}>
          {filteredClosedTrades.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No closed trades found
              {searchTerm && ` for "${searchTerm}"`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Open Price</TableHead>
                    <TableHead>Close Price</TableHead>
                    <TableHead>Open Date</TableHead>
                    <TableHead>Close Date</TableHead>
                    <TableHead>P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClosedTrades.map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium">{trade.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'}>
                          {trade.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatQuantity(trade.qty)}</TableCell>
                      <TableCell>
                        ${trade.limit_price ? formatCurrency(trade.limit_price) : 'Market'}
                      </TableCell>
                      <TableCell>
                        ${trade.close_price ? formatCurrency(trade.close_price) : 'N/A'}
                      </TableCell>
                      <TableCell>{formatDate(trade.created_at)}</TableCell>
                      <TableCell>
                        {trade.filled_at ? formatDate(trade.filled_at) : 'N/A'}
                      </TableCell>
                      <TableCell className={(trade.pnl || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {(trade.pnl || 0) >= 0 ? '+' : ''}${formatCurrency(Math.abs(trade.pnl || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 