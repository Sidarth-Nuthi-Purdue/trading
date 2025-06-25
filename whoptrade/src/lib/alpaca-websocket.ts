/**
 * Alpaca WebSocket Client for Real-time Market Data
 * 
 * This module provides a WebSocket client for streaming real-time market data from Alpaca.
 * It handles authentication, reconnection, and subscription management.
 */

// Alpaca WebSocket endpoints
const ALPACA_STREAM_URL = 'wss://stream.data.alpaca.markets/v2';
const ALPACA_STREAM_URL_SANDBOX = 'wss://stream.data.sandbox.alpaca.markets/v2';

// Message types
type MessageType = 'auth' | 'subscribe' | 'unsubscribe';

// Stream data types
export type StreamChannel = 'trades' | 'quotes' | 'bars' | 'dailyBars' | 'statuses' | 'lulds';

// Subscription channels and symbols
export interface Subscription {
  [channel: string]: string[];
}

// Message handlers
export type MessageHandler = (data: any) => void;

export class AlpacaWebSocketClient {
  private socket: WebSocket | null = null;
  private apiKey: string;
  private apiSecret: string;
  private authenticated = false;
  private connecting = false;
  private subscriptions: Subscription = {};
  private handlers: Record<string, MessageHandler[]> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPong = 0;
  private useSandbox: boolean;

  /**
   * Create a new Alpaca WebSocket client
   * 
   * @param apiKey Alpaca API key
   * @param apiSecret Alpaca API secret
   * @param useSandbox Whether to use the sandbox environment
   */
  constructor(apiKey: string, apiSecret: string, useSandbox = false) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.useSandbox = useSandbox;
  }

  /**
   * Connect to the Alpaca WebSocket server
   */
  public connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connecting) {
      return new Promise((resolve) => {
        this.addEventListener('authenticated', () => resolve());
      });
    }

    this.connecting = true;
    return new Promise((resolve, reject) => {
      try {
        const url = this.useSandbox ? ALPACA_STREAM_URL_SANDBOX : ALPACA_STREAM_URL;
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          console.log('Alpaca WebSocket connected');
          this.authenticate();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.socket.onclose = (event) => {
          console.log(`Alpaca WebSocket closed: ${event.code} ${event.reason}`);
          this.authenticated = false;
          this.connecting = false;
          this.cleanupPingInterval();
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(30000, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            
            this.reconnectTimer = setTimeout(() => {
              this.reconnectAttempts++;
              this.connect()
                .then(() => {
                  // Resubscribe to previous channels
                  this.resubscribe();
                })
                .catch(err => {
                  console.error('Reconnection failed:', err);
                });
            }, delay);
          } else {
            console.error('Max reconnection attempts reached');
            this.triggerEvent('maxReconnectAttemptsReached', {});
          }
        };

        this.socket.onerror = (error) => {
          console.error('Alpaca WebSocket error:', error);
          reject(error);
        };

        // Add one-time authenticated event listener for this connect operation
        const authHandler = () => {
          this.connecting = false;
          resolve();
          this.removeEventListener('authenticated', authHandler);
        };
        this.addEventListener('authenticated', authHandler);

        // Add one-time error handler for connection failures
        const errorHandler = (error: any) => {
          this.connecting = false;
          reject(error);
          this.removeEventListener('error', errorHandler);
        };
        this.addEventListener('error', errorHandler);

      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }

  /**
   * Authenticate with the Alpaca WebSocket server
   */
  private authenticate(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const authMsg = {
      action: 'auth',
      key: this.apiKey,
      secret: this.apiSecret
    };

    this.socket.send(JSON.stringify(authMsg));
  }

  /**
   * Subscribe to a channel for a list of symbols
   * 
   * @param channel Channel to subscribe to
   * @param symbols List of symbols
   */
  public subscribe(channel: StreamChannel, symbols: string[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('Socket not connected, attempting to connect first');
      this.connect()
        .then(() => this.subscribe(channel, symbols))
        .catch(err => console.error('Failed to connect for subscription:', err));
      return;
    }

    // Update subscriptions map
    if (!this.subscriptions[channel]) {
      this.subscriptions[channel] = [];
    }

    // Filter out symbols we're already subscribed to
    const newSymbols = symbols.filter(s => !this.subscriptions[channel].includes(s));
    if (newSymbols.length === 0) {
      return;
    }

    // Add new symbols to subscription list
    this.subscriptions[channel] = [...this.subscriptions[channel], ...newSymbols];

    // Send subscription message
    const subscribeMsg: any = {
      action: 'subscribe'
    };
    subscribeMsg[channel] = newSymbols;

    this.socket.send(JSON.stringify(subscribeMsg));
  }

  /**
   * Unsubscribe from a channel for a list of symbols
   * 
   * @param channel Channel to unsubscribe from
   * @param symbols List of symbols
   */
  public unsubscribe(channel: StreamChannel, symbols: string[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.subscriptions[channel]) {
      return;
    }

    // Find symbols we're actually subscribed to
    const symbolsToUnsubscribe = symbols.filter(s => this.subscriptions[channel].includes(s));
    if (symbolsToUnsubscribe.length === 0) {
      return;
    }

    // Update subscriptions map
    this.subscriptions[channel] = this.subscriptions[channel].filter(s => !symbolsToUnsubscribe.includes(s));

    // Send unsubscribe message
    const unsubscribeMsg: any = {
      action: 'unsubscribe'
    };
    unsubscribeMsg[channel] = symbolsToUnsubscribe;

    this.socket.send(JSON.stringify(unsubscribeMsg));
  }

  /**
   * Resubscribe to all channels (useful after reconnection)
   */
  private resubscribe(): void {
    Object.entries(this.subscriptions).forEach(([channel, symbols]) => {
      if (symbols.length > 0) {
        this.subscribe(channel as StreamChannel, symbols);
      }
    });
  }

  /**
   * Handle incoming messages from the WebSocket
   * 
   * @param event WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const messages = JSON.parse(event.data);
      
      if (!Array.isArray(messages)) {
        console.warn('Received non-array message:', messages);
        return;
      }

      for (const message of messages) {
        // Handle authentication success
        if (message.T === 'success' && message.msg === 'authenticated') {
          this.authenticated = true;
          this.reconnectAttempts = 0; // Reset reconnect attempts on successful auth
          this.startPingInterval(); // Start ping/pong heartbeat
          this.triggerEvent('authenticated', {});
          continue;
        }

        // Handle subscription updates
        if (message.T === 'subscription') {
          this.triggerEvent('subscription', message);
          continue;
        }

        // Handle errors
        if (message.T === 'error') {
          console.error('Alpaca WebSocket error:', message);
          this.triggerEvent('error', message);
          continue;
        }

        // Handle data messages
        switch (message.T) {
          case 't': // Trade
            this.triggerEvent('trade', message);
            break;
          case 'q': // Quote
            this.triggerEvent('quote', message);
            break;
          case 'b': // Bar/Candle
            this.triggerEvent('bar', message);
            break;
          case 's': // Status
            this.triggerEvent('status', message);
            break;
          case 'l': // LULD
            this.triggerEvent('luld', message);
            break;
          case 'c': // Correction
            this.triggerEvent('correction', message);
            break;
          default:
            console.debug('Unknown message type:', message);
        }
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error, event.data);
    }
  }

  /**
   * Add an event listener
   * 
   * @param event Event to listen for
   * @param handler Handler function
   */
  public addEventListener(event: string, handler: MessageHandler): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  /**
   * Remove an event listener
   * 
   * @param event Event to remove listener from
   * @param handler Handler function to remove
   */
  public removeEventListener(event: string, handler: MessageHandler): void {
    if (!this.handlers[event]) {
      return;
    }
    this.handlers[event] = this.handlers[event].filter(h => h !== handler);
  }

  /**
   * Trigger an event
   * 
   * @param event Event to trigger
   * @param data Data to pass to handlers
   */
  private triggerEvent(event: string, data: any): void {
    if (!this.handlers[event]) {
      return;
    }
    for (const handler of this.handlers[event]) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    }
  }

  /**
   * Start a ping interval to keep the connection alive
   */
  private startPingInterval(): void {
    this.cleanupPingInterval();
    
    // Send a ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        // Check if we've received a pong recently
        const now = Date.now();
        if (this.lastPong && now - this.lastPong > 60000) {
          console.warn('No pong received for 60 seconds, reconnecting...');
          this.disconnect();
          this.connect()
            .then(() => this.resubscribe())
            .catch(err => console.error('Failed to reconnect after ping timeout:', err));
          return;
        }
        
        // Send a ping message
        this.socket.send(JSON.stringify({ action: 'ping' }));
      } else {
        this.cleanupPingInterval();
      }
    }, 30000);
  }

  /**
   * Clean up the ping interval
   */
  private cleanupPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Disconnect from the Alpaca WebSocket server
   */
  public disconnect(): void {
    this.cleanupPingInterval();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.authenticated = false;
    this.connecting = false;
  }
}

// Create a singleton instance for the client side
let clientInstance: AlpacaWebSocketClient | null = null;

/**
 * Get the Alpaca WebSocket client instance (singleton)
 * 
 * @returns AlpacaWebSocketClient instance
 */
export function getAlpacaWebSocketClient(): AlpacaWebSocketClient {
  if (!clientInstance) {
    // In a production app, these would be loaded from environment variables
    const apiKey = process.env.NEXT_PUBLIC_ALPACA_API_KEY || 'PKFN69V0XUS87FC3T9VL';
    const apiSecret = process.env.NEXT_PUBLIC_ALPACA_API_SECRET || 'vWfbFQrRN0XdKqHsOj67lkWHflODsjblPR93GosQ';
    
    // Use sandbox for development
    const useSandbox = process.env.NEXT_PUBLIC_ALPACA_USE_SANDBOX === 'true' || true;
    
    clientInstance = new AlpacaWebSocketClient(apiKey, apiSecret, useSandbox);
  }
  
  return clientInstance;
}

/**
 * Custom hook for using Alpaca WebSocket in React components
 * 
 * @param channel Channel to subscribe to
 * @param symbols Symbols to subscribe to
 * @param callback Callback function for messages
 */
export function useAlpacaWebSocket(
  channel: StreamChannel,
  symbols: string[],
  callback: (data: any) => void
): { isConnected: boolean } {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return { isConnected: false };
  }
  
  const client = getAlpacaWebSocketClient();
  let isConnected = false;
  
  // Connect and subscribe
  client.connect().then(() => {
    isConnected = true;
    client.subscribe(channel, symbols);
    
    // Add event listener for the specified channel
    client.addEventListener(channel === 'bars' ? 'bar' : channel.slice(0, -1), callback);
  }).catch(err => {
    console.error(`Failed to connect to Alpaca WebSocket for ${channel}:`, err);
  });
  
  // Return connection status
  return { isConnected };
}

export default AlpacaWebSocketClient; 