/**
 * TradingView Broker API Implementation
 * This module implements the TradingView Broker API interface to handle orders,
 * positions, and executions for paper trading with Supabase persistence.
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatPrice } from './format';

// TradingView Broker API Types
export enum OrderType {
  Limit = 1,
  Market = 2,
  Stop = 3,
  StopLimit = 4,
}

export enum OrderStatus {
  Canceled = 1,
  Filled = 2,
  Inactive = 3,
  Rejected = 4,
  Working = 6,
  Placing = 7,
}

export enum OrderSide {
  Buy = 1,
  Sell = -1,
}

export enum ParentType {
  Order = 1,
  Position = 2,
}

export interface IOrder {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  qty: number;
  status: OrderStatus;
  limitPrice?: number;
  stopPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
}

export interface PlacedOrder extends IOrder {
  filledQty?: number;
  avgPrice?: number;
  updateTime?: number;
  createdTime?: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  avgPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  customFields?: Record<string, any>;
}

export interface IndividualPosition extends Position {
  entryTime?: number;
}

export interface Execution {
  id?: string;
  symbol: string;
  side: OrderSide;
  price: number;
  qty: number;
  time: number;
  orderId?: string;
}

export interface PreOrder {
  symbol: string;
  type: OrderType;
  side: OrderSide;
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  isClose?: boolean;
  customFields?: Record<string, any>;
  currentQuotes?: {
    bid: number;
    ask: number;
  };
}

export interface BracketOrder extends IOrder {
  parentId: string;
  parentType: ParentType;
  limitPrice?: number;
  stopPrice?: number;
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  qty: number;
  status: OrderStatus;
}

export interface PlaceOrderResult {
  orderId: string;
  succeeded: boolean;
  message?: string;
}

// TradingView Host Interface
export interface IBrokerConnectionAdapterHost {
  connectionOpened(): void;
  connectionClosed(): void;
  connectionError(error: string): void;
  sessionEstablished(): void;
  orderUpdate(order: PlacedOrder | BracketOrder): void;
  positionUpdate(position: Position): void;
  executionUpdate(execution: Execution): void;
  plUpdate(id: string, pl: number, realizedPl: number): void;
  equityUpdate(equity: number[]): void;
  orderPartialUpdate(data: PlacedOrder): void;
  positionPartialUpdate(data: Position): void;
  individualPositionUpdate(position: IndividualPosition): void;
  individualPositionPLUpdate(id: string, pl: number): void;
}

// Broker API Implementation
export class TradingViewBrokerApi {
  private host: IBrokerConnectionAdapterHost;
  private supabase: any;
  private userId: string | null = null;
  private accountId: string | null = null;
  private orders: Map<string, PlacedOrder> = new Map();
  private positions: Map<string, Position> = new Map();
  private executions: Execution[] = [];
  private equity: number = 100000; // Default starting equity
  private nextOrderId: number = 1;

  constructor(host: IBrokerConnectionAdapterHost) {
    this.host = host;
    this.supabase = createClientComponentClient();
    this.initializeConnection();
  }

  // Initialize connection with the broker
  private async initializeConnection() {
    try {
      // Notify the host that connection is opened
      this.host.connectionOpened();

      // Get current user
      const { data: { user } } = await this.supabase.auth.getUser();
      
      // If user is not authenticated, just set up a demo mode
      if (!user) {
        console.log('User not authenticated, using demo mode');
        this.equity = 100000; // Default demo equity
        this.host.sessionEstablished();
        this.host.equityUpdate([this.equity]);
        return;
      }
      
      this.userId = user.id;

      // Get or create trading account for the user
      const { data: accountData, error: accountError } = await this.supabase
        .from('trading_accounts')
        .select('id, balance')
        .eq('user_id', this.userId)
        .single();

      if (accountError && accountError.code !== 'PGRST116') {
        throw new Error(`Error fetching trading account: ${accountError.message}`);
      }

      if (!accountData) {
        // Create a new account with default equity
        const { data: newAccount, error: createError } = await this.supabase
          .from('trading_accounts')
          .insert([
            { user_id: this.userId, balance: this.equity }
          ])
          .select('id, balance')
          .single();

        if (createError) {
          throw new Error(`Error creating trading account: ${createError.message}`);
        }

        this.accountId = newAccount.id;
        this.equity = newAccount.balance;
      } else {
        this.accountId = accountData.id;
        this.equity = accountData.balance;
      }

      // Load existing orders
      await this.loadOrders();

      // Load existing positions
      await this.loadPositions();

      // Notify the host that session is established
      this.host.sessionEstablished();
      this.host.equityUpdate([this.equity]);

    } catch (error) {
      console.error('Error initializing broker connection:', error);
      this.host.connectionError(error instanceof Error ? error.message : 'Unknown error');
      this.host.connectionClosed();
    }
  }

  // Load existing orders from Supabase
  private async loadOrders() {
    try {
      if (!this.accountId) return;

      const { data: ordersData, error } = await this.supabase
        .from('trading_orders')
        .select('*')
        .eq('account_id', this.accountId)
        .in('status', ['open', 'working', 'placing']);

      if (error) {
        throw new Error(`Error loading orders: ${error.message}`);
      }

      // Convert and store the orders
      if (ordersData && ordersData.length > 0) {
        ordersData.forEach((order: any) => {
          const placedOrder: PlacedOrder = {
            id: order.id.toString(),
            symbol: order.symbol,
            type: this.mapOrderType(order.type),
            side: order.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
            qty: parseFloat(order.quantity),
            status: this.mapOrderStatus(order.status),
            limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
            stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
            takeProfit: order.take_profit ? parseFloat(order.take_profit) : undefined,
            stopLoss: order.stop_loss ? parseFloat(order.stop_loss) : undefined,
            createdTime: new Date(order.created_at).getTime(),
            updateTime: new Date(order.updated_at).getTime(),
          };

          this.orders.set(order.id.toString(), placedOrder);
          this.host.orderUpdate(placedOrder);
          
          // Update next order ID
          const orderId = parseInt(order.id.toString());
          if (orderId >= this.nextOrderId) {
            this.nextOrderId = orderId + 1;
          }
        });
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  }

  // Load existing positions from Supabase
  private async loadPositions() {
    try {
      if (!this.accountId) return;

      const { data: positionsData, error } = await this.supabase
        .from('trading_positions')
        .select('*')
        .eq('account_id', this.accountId)
        .gt('quantity', 0); // Only get active positions

      if (error) {
        throw new Error(`Error loading positions: ${error.message}`);
      }

      // Convert and store the positions
      if (positionsData && positionsData.length > 0) {
        positionsData.forEach((pos: any) => {
          const position: Position = {
            id: pos.symbol,
            symbol: pos.symbol,
            side: pos.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
            qty: parseFloat(pos.quantity),
            avgPrice: parseFloat(pos.avg_price),
            takeProfit: pos.take_profit ? parseFloat(pos.take_profit) : undefined,
            stopLoss: pos.stop_loss ? parseFloat(pos.stop_loss) : undefined,
          };

          this.positions.set(pos.symbol, position);
          this.host.positionUpdate(position);
          
          // Update P&L
          this.updatePositionPL(pos.symbol);
        });
      }
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  }

  // Map Supabase order type to TradingView OrderType
  private mapOrderType(type: string): OrderType {
    switch (type) {
      case 'limit':
        return OrderType.Limit;
      case 'stop':
        return OrderType.Stop;
      case 'stop_limit':
        return OrderType.StopLimit;
      case 'market':
      default:
        return OrderType.Market;
    }
  }

  // Map TradingView OrderType to Supabase order type
  private reverseMapOrderType(type: OrderType): string {
    switch (type) {
      case OrderType.Limit:
        return 'limit';
      case OrderType.Stop:
        return 'stop';
      case OrderType.StopLimit:
        return 'stop_limit';
      case OrderType.Market:
      default:
        return 'market';
    }
  }

  // Map Supabase order status to TradingView OrderStatus
  private mapOrderStatus(status: string): OrderStatus {
    switch (status) {
      case 'canceled':
        return OrderStatus.Canceled;
      case 'filled':
        return OrderStatus.Filled;
      case 'inactive':
        return OrderStatus.Inactive;
      case 'rejected':
        return OrderStatus.Rejected;
      case 'placing':
        return OrderStatus.Placing;
      case 'working':
      case 'open':
      default:
        return OrderStatus.Working;
    }
  }

  // Map TradingView OrderStatus to Supabase order status
  private reverseMapOrderStatus(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.Canceled:
        return 'canceled';
      case OrderStatus.Filled:
        return 'filled';
      case OrderStatus.Inactive:
        return 'inactive';
      case OrderStatus.Rejected:
        return 'rejected';
      case OrderStatus.Placing:
        return 'placing';
      case OrderStatus.Working:
      default:
        return 'working';
    }
  }

  // Get real-time quote for a symbol
  private async getQuote(symbol: string): Promise<{ bid: number; ask: number }> {
    try {
      const response = await fetch(`/api/market-data/latest-quote?symbol=${encodeURIComponent(symbol)}`);
      const data = await response.json();
      
      if (!response.ok || !data.quote) {
        throw new Error(`Failed to fetch quote for ${symbol}`);
      }
      
      return {
        bid: data.quote.bid || data.quote.price,
        ask: data.quote.ask || data.quote.price
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      throw error;
    }
  }

  // Update P&L for a position
  private async updatePositionPL(symbol: string) {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;

      const quote = await this.getQuote(symbol);
      const currentPrice = position.side === OrderSide.Buy ? quote.bid : quote.ask;
      
      // Calculate P&L
      const pl = position.side === OrderSide.Buy
        ? (currentPrice - position.avgPrice) * position.qty
        : (position.avgPrice - currentPrice) * position.qty;
      
      // Update P&L
      this.host.plUpdate(position.id, pl, 0);
    } catch (error) {
      console.error(`Error updating P&L for ${symbol}:`, error);
    }
  }

  // Required Broker API methods
  public async orders() {
    return Array.from(this.orders.values());
  }

  public async positions() {
    return Array.from(this.positions.values());
  }

  public async executions() {
    return this.executions;
  }
  
  public async ordersHistory() {
    try {
      if (!this.accountId) return [];

      const { data: ordersData, error } = await this.supabase
        .from('trading_orders')
        .select('*')
        .eq('account_id', this.accountId)
        .in('status', ['filled', 'canceled', 'rejected']);

      if (error) {
        throw new Error(`Error loading order history: ${error.message}`);
      }

      // Convert orders to PlacedOrder format
      return ordersData.map((order: any) => ({
        id: order.id.toString(),
        symbol: order.symbol,
        type: this.mapOrderType(order.type),
        side: order.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
        qty: parseFloat(order.quantity),
        status: this.mapOrderStatus(order.status),
        limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
        stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
        filledQty: order.filled_quantity ? parseFloat(order.filled_quantity) : undefined,
        avgPrice: order.filled_price ? parseFloat(order.filled_price) : undefined,
        createdTime: new Date(order.created_at).getTime(),
        updateTime: new Date(order.updated_at).getTime(),
      }));
    } catch (error) {
      console.error('Error loading order history:', error);
      return [];
    }
  }

  public async accountManagerInfo() {
    return {
      accountTitle: 'Paper Trading',
      accountSummary: [
        { title: 'Balance', value: formatPrice(this.equity) }
      ],
      orderColumns: [
        { id: 'symbol', title: 'Symbol' },
        { id: 'type', title: 'Type' },
        { id: 'side', title: 'Side' },
        { id: 'qty', title: 'Quantity' },
        { id: 'limitPrice', title: 'Limit Price' },
        { id: 'stopPrice', title: 'Stop Price' },
        { id: 'status', title: 'Status' },
      ],
      positionColumns: [
        { id: 'symbol', title: 'Symbol' },
        { id: 'side', title: 'Side' },
        { id: 'qty', title: 'Quantity' },
        { id: 'avgPrice', title: 'Avg Price' },
        { id: 'pl', title: 'P&L' },
      ],
      historyColumns: [
        { id: 'symbol', title: 'Symbol' },
        { id: 'side', title: 'Side' },
        { id: 'qty', title: 'Quantity' },
        { id: 'type', title: 'Type' },
        { id: 'status', title: 'Status' },
        { id: 'price', title: 'Price' },
        { id: 'time', title: 'Time' },
      ]
    };
  }

  public chartContextMenuActions(context: any) {
    return [];
  }

  public isTradable(symbol: string): boolean {
    return true; // All symbols are tradable in paper trading
  }

  // Method to place an order
  public async placeOrder(order: PreOrder): Promise<PlaceOrderResult> {
    try {
      if (!this.accountId) {
        throw new Error('Trading account not found');
      }

      const orderId = this.nextOrderId.toString();
      this.nextOrderId++;

      // Get current quotes if not provided
      const quotes = order.currentQuotes || await this.getQuote(order.symbol);
      
      // Determine price for market orders
      let executionPrice = order.side === OrderSide.Buy ? quotes.ask : quotes.bid;
      if (order.type === OrderType.Limit && order.limitPrice) {
        executionPrice = order.limitPrice;
      }

      // Create order record in Supabase
      const { data: newOrder, error } = await this.supabase
        .from('trading_orders')
        .insert([
          {
            account_id: this.accountId,
            symbol: order.symbol,
            type: this.reverseMapOrderType(order.type),
            side: order.side === OrderSide.Buy ? 'buy' : 'sell',
            quantity: order.qty,
            limit_price: order.limitPrice,
            stop_price: order.stopPrice,
            take_profit: order.takeProfit,
            stop_loss: order.stopLoss,
            status: 'working',
            is_close: order.isClose || false
          }
        ])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Error creating order: ${error.message}`);
      }

      // Create and notify about the new order
      const placedOrder: PlacedOrder = {
        id: newOrder.id.toString(),
        symbol: newOrder.symbol,
        type: this.mapOrderType(newOrder.type),
        side: newOrder.side === 'buy' ? OrderSide.Buy : OrderSide.Sell,
        qty: parseFloat(newOrder.quantity),
        status: OrderStatus.Working,
        limitPrice: newOrder.limit_price ? parseFloat(newOrder.limit_price) : undefined,
        stopPrice: newOrder.stop_price ? parseFloat(newOrder.stop_price) : undefined,
        takeProfit: newOrder.take_profit ? parseFloat(newOrder.take_profit) : undefined,
        stopLoss: newOrder.stop_loss ? parseFloat(newOrder.stop_loss) : undefined,
        createdTime: new Date(newOrder.created_at).getTime(),
        updateTime: new Date(newOrder.updated_at).getTime(),
      };

      this.orders.set(placedOrder.id, placedOrder);
      this.host.orderUpdate(placedOrder);

      // For market orders, execute immediately
      if (order.type === OrderType.Market) {
        await this.executeOrder(placedOrder.id, executionPrice);
      }

      return {
        orderId: placedOrder.id,
        succeeded: true
      };
    } catch (error) {
      console.error('Error placing order:', error);
      return {
        orderId: '',
        succeeded: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Execute an order
  private async executeOrder(orderId: string, price: number) {
    try {
      const order = this.orders.get(orderId);
      if (!order || !this.accountId) return;

      // Update order status
      const { data: updatedOrder, error: orderError } = await this.supabase
        .from('trading_orders')
        .update({
          status: 'filled',
          filled_price: price,
          filled_quantity: order.qty,
          filled_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select('*')
        .single();

      if (orderError) {
        throw new Error(`Error updating order: ${orderError.message}`);
      }

      // Create execution record
      const execution: Execution = {
        symbol: order.symbol,
        side: order.side,
        price: price,
        qty: order.qty,
        time: Date.now(),
        orderId: orderId
      };

      // Insert execution into Supabase
      const { error: executionError } = await this.supabase
        .from('trading_executions')
        .insert([
          {
            account_id: this.accountId,
            order_id: orderId,
            symbol: order.symbol,
            side: order.side === OrderSide.Buy ? 'buy' : 'sell',
            price: price,
            quantity: order.qty,
            executed_at: new Date().toISOString()
          }
        ]);

      if (executionError) {
        throw new Error(`Error creating execution record: ${executionError.message}`);
      }

      // Update positions
      await this.updatePosition(order, price);

      // Update order in memory
      const filledOrder: PlacedOrder = {
        ...order,
        status: OrderStatus.Filled,
        filledQty: order.qty,
        avgPrice: price,
        updateTime: Date.now()
      };
      this.orders.set(orderId, filledOrder);

      // Notify host about execution and order update
      this.host.executionUpdate(execution);
      this.host.orderUpdate(filledOrder);

      // Add to local executions list
      this.executions.push(execution);

    } catch (error) {
      console.error(`Error executing order ${orderId}:`, error);
    }
  }

  // Update position after order execution
  private async updatePosition(order: PlacedOrder, price: number) {
    try {
      if (!this.accountId) return;

      const symbol = order.symbol;
      const existingPosition = this.positions.get(symbol);
      
      let newPosition: Position | null = null;

      // If closing a position
      if (order.isClose && existingPosition) {
        // Calculate remaining quantity
        const remainingQty = Math.max(0, existingPosition.qty - order.qty);
        
        if (remainingQty === 0) {
          // Position is fully closed
          await this.supabase
            .from('trading_positions')
            .update({ quantity: 0, closed_at: new Date().toISOString() })
            .eq('account_id', this.accountId)
            .eq('symbol', symbol);
          
          // Remove from positions map
          this.positions.delete(symbol);
          
          // Update equity
          const pnl = existingPosition.side === OrderSide.Buy
            ? (price - existingPosition.avgPrice) * existingPosition.qty
            : (existingPosition.avgPrice - price) * existingPosition.qty;
          
          this.equity += pnl;
          await this.supabase
            .from('trading_accounts')
            .update({ balance: this.equity })
            .eq('id', this.accountId);
          
          this.host.equityUpdate([this.equity]);
          
          // Update position with zero quantity
          newPosition = {
            ...existingPosition,
            qty: 0
          };
        } else {
          // Position is partially closed
          newPosition = {
            ...existingPosition,
            qty: remainingQty
          };
          
          // Update in database
          await this.supabase
            .from('trading_positions')
            .update({ quantity: remainingQty })
            .eq('account_id', this.accountId)
            .eq('symbol', symbol);
          
          // Update P&L
          const pnl = existingPosition.side === OrderSide.Buy
            ? (price - existingPosition.avgPrice) * order.qty
            : (existingPosition.avgPrice - price) * order.qty;
          
          this.equity += pnl;
          await this.supabase
            .from('trading_accounts')
            .update({ balance: this.equity })
            .eq('id', this.accountId);
          
          this.host.equityUpdate([this.equity]);
        }
      } else {
        // Creating or adding to a position
        if (existingPosition) {
          // Position exists - update it
          if (existingPosition.side === order.side) {
            // Same direction - update average price
            const totalQty = existingPosition.qty + order.qty;
            const totalCost = (existingPosition.avgPrice * existingPosition.qty) + (price * order.qty);
            const newAvgPrice = totalCost / totalQty;
            
            newPosition = {
              ...existingPosition,
              qty: totalQty,
              avgPrice: newAvgPrice
            };
            
            // Update in database
            await this.supabase
              .from('trading_positions')
              .update({
                quantity: totalQty,
                avg_price: newAvgPrice
              })
              .eq('account_id', this.accountId)
              .eq('symbol', symbol);
          } else {
            // Opposite direction - reduce or flip position
            const netQty = existingPosition.qty - order.qty;
            
            if (netQty > 0) {
              // Reduce position
              newPosition = {
                ...existingPosition,
                qty: netQty
              };
              
              // Update in database
              await this.supabase
                .from('trading_positions')
                .update({ quantity: netQty })
                .eq('account_id', this.accountId)
                .eq('symbol', symbol);
            } else if (netQty < 0) {
              // Flip position
              newPosition = {
                ...existingPosition,
                side: order.side,
                qty: Math.abs(netQty),
                avgPrice: price
              };
              
              // Update in database
              await this.supabase
                .from('trading_positions')
                .update({
                  side: order.side === OrderSide.Buy ? 'buy' : 'sell',
                  quantity: Math.abs(netQty),
                  avg_price: price
                })
                .eq('account_id', this.accountId)
                .eq('symbol', symbol);
            } else {
              // Position is closed
              await this.supabase
                .from('trading_positions')
                .update({
                  quantity: 0,
                  closed_at: new Date().toISOString()
                })
                .eq('account_id', this.accountId)
                .eq('symbol', symbol);
              
              // Remove from positions map
              this.positions.delete(symbol);
              
              // Create zero quantity position for update
              newPosition = {
                ...existingPosition,
                qty: 0
              };
            }
          }
        } else {
          // New position
          newPosition = {
            id: symbol,
            symbol: symbol,
            side: order.side,
            qty: order.qty,
            avgPrice: price,
            takeProfit: order.takeProfit,
            stopLoss: order.stopLoss
          };
          
          // Create in database
          await this.supabase
            .from('trading_positions')
            .insert([
              {
                account_id: this.accountId,
                symbol: symbol,
                side: order.side === OrderSide.Buy ? 'buy' : 'sell',
                quantity: order.qty,
                avg_price: price,
                take_profit: order.takeProfit,
                stop_loss: order.stopLoss
              }
            ]);
        }
      }
      
      // Update in memory and notify host
      if (newPosition) {
        if (newPosition.qty > 0) {
          this.positions.set(symbol, newPosition);
          this.host.positionUpdate(newPosition);
        } else {
          // Notify zero quantity to host, then delete
          this.host.positionUpdate(newPosition);
          this.positions.delete(symbol);
        }
        
        // Update position P&L
        if (newPosition.qty > 0) {
          await this.updatePositionPL(symbol);
        }
      }
    } catch (error) {
      console.error(`Error updating position for ${order.symbol}:`, error);
    }
  }

  // Cancel an order
  public async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const order = this.orders.get(orderId);
      if (!order) return false;
      
      // Update in database
      const { error } = await this.supabase
        .from('trading_orders')
        .update({ status: 'canceled' })
        .eq('id', orderId);
      
      if (error) {
        throw new Error(`Error canceling order: ${error.message}`);
      }
      
      // Update in memory
      const canceledOrder = {
        ...order,
        status: OrderStatus.Canceled,
        updateTime: Date.now()
      };
      this.orders.set(orderId, canceledOrder);
      
      // Notify host
      this.host.orderUpdate(canceledOrder);
      
      return true;
    } catch (error) {
      console.error(`Error canceling order ${orderId}:`, error);
      return false;
    }
  }

  // Get quotes for symbols
  public async getQuotes(symbols: string[]) {
    try {
      const quotes: Record<string, { bid: number; ask: number; }> = {};
      
      for (const symbol of symbols) {
        const quote = await this.getQuote(symbol);
        quotes[symbol] = quote;
      }
      
      return quotes;
    } catch (error) {
      console.error('Error getting quotes:', error);
      return {};
    }
  }

  // Subscribe to quotes
  public async subscribeQuotes(symbols: string[], listener: any) {
    try {
      // Initial quotes
      const quotes = await this.getQuotes(symbols);
      listener(quotes);
      
      // In a real implementation, set up websocket or polling for quote updates
      const intervalId = setInterval(async () => {
        try {
          const updatedQuotes = await this.getQuotes(symbols);
          listener(updatedQuotes);
          
          // Update P&L for all positions that match these symbols
          for (const symbol of symbols) {
            if (this.positions.has(symbol)) {
              this.updatePositionPL(symbol);
            }
          }
        } catch (quoteError) {
          console.error('Error in quote subscription:', quoteError);
        }
      }, 5000); // Update every 5 seconds
      
      return intervalId;
    } catch (error) {
      console.error('Error subscribing to quotes:', error);
      return null;
    }
  }

  // Unsubscribe from quotes
  public unsubscribeQuotes(subscriberId: any) {
    if (subscriberId && typeof subscriberId === 'number') {
      clearInterval(subscriberId);
    }
  }

  // Modify an order
  public async modifyOrder(orderId: string, order: PreOrder): Promise<boolean> {
    try {
      const existingOrder = this.orders.get(orderId);
      if (!existingOrder) return false;
      
      // Update in database
      const { error } = await this.supabase
        .from('trading_orders')
        .update({
          quantity: order.qty,
          limit_price: order.limitPrice,
          stop_price: order.stopPrice,
          take_profit: order.takeProfit,
          stop_loss: order.stopLoss,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (error) {
        throw new Error(`Error modifying order: ${error.message}`);
      }
      
      // Update in memory
      const modifiedOrder = {
        ...existingOrder,
        qty: order.qty,
        limitPrice: order.limitPrice,
        stopPrice: order.stopPrice,
        takeProfit: order.takeProfit,
        stopLoss: order.stopLoss,
        updateTime: Date.now()
      };
      this.orders.set(orderId, modifiedOrder);
      
      // Notify host
      this.host.orderUpdate(modifiedOrder);
      
      return true;
    } catch (error) {
      console.error(`Error modifying order ${orderId}:`, error);
      return false;
    }
  }

  // Edit position brackets
  public async editPositionBrackets(positionId: string, stopLoss?: number, takeProfit?: number): Promise<boolean> {
    try {
      const position = this.positions.get(positionId);
      if (!position) return false;
      
      // Update in database
      const { error } = await this.supabase
        .from('trading_positions')
        .update({
          take_profit: takeProfit,
          stop_loss: stopLoss,
          updated_at: new Date().toISOString()
        })
        .eq('account_id', this.accountId)
        .eq('symbol', positionId);
      
      if (error) {
        throw new Error(`Error updating position brackets: ${error.message}`);
      }
      
      // Update in memory
      const updatedPosition = {
        ...position,
        takeProfit,
        stopLoss
      };
      this.positions.set(positionId, updatedPosition);
      
      // Notify host
      this.host.positionUpdate(updatedPosition);
      
      return true;
    } catch (error) {
      console.error(`Error updating brackets for position ${positionId}:`, error);
      return false;
    }
  }

  // Close position
  public async closePosition(positionId: string, amount?: number): Promise<boolean> {
    try {
      const position = this.positions.get(positionId);
      if (!position) return false;
      
      const closeQty = amount || position.qty;
      
      // Place an order to close the position
      const result = await this.placeOrder({
        symbol: position.symbol,
        side: position.side === OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy,
        qty: closeQty,
        type: OrderType.Market,
        isClose: true
      });
      
      return result.succeeded;
    } catch (error) {
      console.error(`Error closing position ${positionId}:`, error);
      return false;
    }
  }

  // Reversal position
  public async reversePosition(positionId: string): Promise<boolean> {
    try {
      const position = this.positions.get(positionId);
      if (!position) return false;
      
      // First close the current position
      const closeResult = await this.closePosition(positionId);
      if (!closeResult) {
        throw new Error('Failed to close position for reversal');
      }
      
      // Then open a new position in the opposite direction
      const openResult = await this.placeOrder({
        symbol: position.symbol,
        side: position.side === OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy,
        qty: position.qty,
        type: OrderType.Market
      });
      
      return openResult.succeeded;
    } catch (error) {
      console.error(`Error reversing position ${positionId}:`, error);
      return false;
    }
  }
}

export default TradingViewBrokerApi; 