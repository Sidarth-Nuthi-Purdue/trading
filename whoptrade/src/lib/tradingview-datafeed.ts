/**
 * TradingView Datafeed Implementation
 * This module provides a custom implementation of the TradingView Datafeed API
 * to fetch and display real-time market data without relying on Alpaca API.
 */

import { 
  LibrarySymbolInfo,
  SearchSymbolResultItem,
  ResolutionString,
  HistoryCallback,
  SubscribeBarsCallback,
  ErrorCallback,
  DatafeedConfiguration,
  IDatafeedChartApi,
  ResolveCallback,
  Bar
} from '../types/tradingview';

// Default configuration for the datafeed
const configurationData: DatafeedConfiguration = {
  supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
  supports_marks: false,
  supports_timescale_marks: false,
  supports_time: true,
  exchanges: [
    { value: '', name: 'All Exchanges', desc: '' },
    { value: 'NYSE', name: 'NYSE', desc: 'New York Stock Exchange' },
    { value: 'NASDAQ', name: 'NASDAQ', desc: 'NASDAQ Stock Market' },
    { value: 'AMEX', name: 'AMEX', desc: 'American Stock Exchange' },
  ],
  symbols_types: [
    { name: 'All Types', value: '' },
    { name: 'Stock', value: 'stock' },
    { name: 'ETF', value: 'etf' },
    { name: 'Forex', value: 'forex' },
    { name: 'Crypto', value: 'crypto' },
    { name: 'Index', value: 'index' },
  ]
};

// Map TradingView resolutions to API intervals
const resolutionToInterval: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '240': '4h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1M'
};

// Subscription storage
interface Subscription {
  symbolInfo: LibrarySymbolInfo;
  resolution: string;
  lastBar: Bar | null;
  listener: SubscribeBarsCallback;
}

// Finnhub API key - use environment variable
const FINNHUB_API_KEY = typeof window !== 'undefined' 
  ? process.env.NEXT_PUBLIC_FINNHUB_API_KEY 
  : process.env.FINNHUB_API_KEY;

export class TradingViewDatafeed implements IDatafeedChartApi {
  private subscriptions: Record<string, Subscription> = {};
  private lastBarsCache: Record<string, Bar> = {};
  private datafeedURL: string;
  private wsConnection: WebSocket | null = null;
  private wsConnected = false;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private useWebSocket: boolean;

  constructor(datafeedURL = 'https://api.example.com', useWebSocket = false) {
    this.datafeedURL = datafeedURL;
    this.useWebSocket = useWebSocket;
    
    // Only try to connect WebSocket if enabled
    if (this.useWebSocket) {
      this.setupWebSocket();
    }
  }

  /**
   * Setup WebSocket connection for real-time data
   */
  private setupWebSocket(): void {
    // Use Finnhub WebSocket API
    try {
      // Use the API key from environment or the hardcoded value
      const wsURL = `wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`;
      
      this.wsConnection = new WebSocket(wsURL);
      
      this.wsConnection.onopen = () => {
        console.log('WebSocket connected');
        this.wsConnected = true;
        
        // Subscribe to symbols
        Object.keys(this.subscriptions).forEach(symbol => {
          if (this.wsConnection) {
            this.wsConnection.send(JSON.stringify({
              type: 'subscribe',
              symbol: symbol
            }));
          }
        });
      };
      
      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Process the data based on Finnhub's format
          if (data.type === 'trade') {
            const trades = data.data;
            if (!trades || trades.length === 0) return;
            
            const symbol = trades[0].s;
            const price = trades[0].p;
            const timestamp = trades[0].t;
            
            if (symbol && price && timestamp && this.subscriptions[symbol]) {
              const sub = this.subscriptions[symbol];
              const lastBar = sub.lastBar;
              
              if (lastBar) {
                // Update the last bar or create a new one based on the resolution
                const currentTime = this.getBarTime(sub.resolution, timestamp);
                
                if (lastBar.time === currentTime) {
                  // Update existing bar
                  lastBar.high = Math.max(lastBar.high, price);
                  lastBar.low = Math.min(lastBar.low, price);
                  lastBar.close = price;
                  
                  sub.listener(lastBar);
                } else if (currentTime > (lastBar.time as number)) {
                  // Create a new bar
                  const newBar = {
                    time: currentTime,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: 0
                  };
                  
                  sub.lastBar = newBar;
                  sub.listener(newBar);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      this.wsConnection.onclose = () => {
        console.log('WebSocket disconnected');
        this.wsConnected = false;
        
        // Reconnect after a delay
        if (!this.wsReconnectTimer) {
          this.wsReconnectTimer = setTimeout(() => {
            this.setupWebSocket();
            this.wsReconnectTimer = null;
          }, 5000);
        }
      };
      
      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.wsConnected = false;
      };
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
      this.wsConnected = false;
    }
  }

  /**
   * Calculate bar time based on resolution and timestamp
   */
  private getBarTime(resolution: string, timestamp: number): number {
    const date = new Date(timestamp);
    
    switch (resolution) {
      case '1D':
        // Daily bars - set to midnight UTC
        date.setUTCHours(0, 0, 0, 0);
        break;
      case '1W':
        // Weekly bars - set to Monday midnight UTC
        const dayOfWeek = date.getUTCDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust Sunday (0) to 6
        date.setUTCDate(date.getUTCDate() - diff);
        date.setUTCHours(0, 0, 0, 0);
        break;
      case '1M':
        // Monthly bars - set to first day of month, midnight UTC
        date.setUTCDate(1);
        date.setUTCHours(0, 0, 0, 0);
        break;
      default:
        // For intraday resolutions, round to the nearest interval
        const minutes = parseInt(resolution);
        if (!isNaN(minutes)) {
          const ms = minutes * 60 * 1000;
          const roundedTime = Math.floor(timestamp / ms) * ms;
          return roundedTime / 1000;
        }
    }
    
    return date.getTime() / 1000;
  }

  /**
   * Get configuration data
   */
  onReady(callback: (configuration: DatafeedConfiguration) => void): void {
    console.log('[Datafeed] onReady');
    setTimeout(() => callback(configurationData), 0);
  }

  /**
   * Search for symbols
   */
  async searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: (result: SearchSymbolResultItem[]) => void
  ): Promise<void> {
    console.log('[Datafeed] searchSymbols:', userInput, exchange, symbolType);
    
    try {
      // Use our API endpoint to search for symbols
      const response = await fetch(`/api/market-data/search?query=${encodeURIComponent(userInput)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.symbols) {
        onResult([]);
        return;
      }
      
      // Transform the API response to match TradingView's expected format
      const symbols = data.symbols.map((item: any) => ({
        symbol: item.symbol,
        full_name: item.symbol,
        description: item.name || item.symbol,
        exchange: item.exchange || 'NYSE',
        ticker: item.symbol,
        type: item.type || 'stock'
      }));
      
      onResult(symbols);
    } catch (error) {
      console.error('Error searching symbols:', error);
      
      // Fallback to some common symbols if search fails
      const fallbackSymbols = [
        { symbol: 'AAPL', full_name: 'AAPL', description: 'Apple Inc', exchange: 'NASDAQ', ticker: 'AAPL', type: 'stock' },
        { symbol: 'MSFT', full_name: 'MSFT', description: 'Microsoft Corporation', exchange: 'NASDAQ', ticker: 'MSFT', type: 'stock' },
        { symbol: 'AMZN', full_name: 'AMZN', description: 'Amazon.com Inc', exchange: 'NASDAQ', ticker: 'AMZN', type: 'stock' },
        { symbol: 'GOOGL', full_name: 'GOOGL', description: 'Alphabet Inc', exchange: 'NASDAQ', ticker: 'GOOGL', type: 'stock' },
        { symbol: 'META', full_name: 'META', description: 'Meta Platforms Inc', exchange: 'NASDAQ', ticker: 'META', type: 'stock' }
      ];
      
      if (userInput.length > 0) {
        const filtered = fallbackSymbols.filter(s => 
          s.symbol.toLowerCase().includes(userInput.toLowerCase()) || 
          s.description.toLowerCase().includes(userInput.toLowerCase())
        );
        onResult(filtered);
      } else {
        onResult(fallbackSymbols);
      }
    }
  }

  /**
   * Resolve symbol info
   */
  async resolveSymbol(
    symbolName: string,
    onResolve: ResolveCallback,
    onError: ErrorCallback
  ): Promise<void> {
    console.log('[Datafeed] resolveSymbol:', symbolName);
    
    try {
      // Try to fetch symbol info from our API
      const response = await fetch(`/api/market-data/latest-quote?symbol=${encodeURIComponent(symbolName)}`);
      
      if (!response.ok) {
        // If API fails, use basic symbol info
        const symbolInfo: LibrarySymbolInfo = {
          name: symbolName,
          ticker: symbolName,
          full_name: symbolName,
          description: symbolName,
          type: 'stock',
          session: '0930-1600',
          timezone: 'America/New_York',
          exchange: 'NYSE',
          minmov: 1,
          pricescale: 100,
          has_intraday: true,
          has_daily: true,
          has_weekly_and_monthly: true,
          supported_resolutions: configurationData.supported_resolutions as ResolutionString[],
          volume_precision: 2,
          data_status: 'streaming',
        };
        
        setTimeout(() => onResolve(symbolInfo), 0);
        return;
      }
      
      const data = await response.json();
      const quote = data.quote;
      
      // Determine appropriate price scale based on price
      let pricescale = 100; // Default 2 decimal places
      if (quote && quote.price) {
        if (quote.price < 1) pricescale = 10000; // 4 decimal places
        else if (quote.price < 10) pricescale = 1000; // 3 decimal places
        else if (quote.price >= 1000) pricescale = 10; // 1 decimal place
      }
      
      const symbolInfo: LibrarySymbolInfo = {
        name: symbolName,
        ticker: symbolName,
        full_name: symbolName,
        description: quote?.shortName || quote?.longName || symbolName,
        type: 'stock',
        session: '0930-1600',
        timezone: 'America/New_York',
        exchange: quote?.exchange || 'NYSE',
        minmov: 1,
        pricescale: pricescale,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: configurationData.supported_resolutions as ResolutionString[],
        volume_precision: 2,
        data_status: 'streaming',
      };
      
      setTimeout(() => onResolve(symbolInfo), 0);
    } catch (error) {
      console.error('Error resolving symbol:', error);
      
      // Fallback to basic symbol info
      const symbolInfo: LibrarySymbolInfo = {
        name: symbolName,
        ticker: symbolName,
        full_name: symbolName,
        description: symbolName,
        type: 'stock',
        session: '0930-1600',
        timezone: 'America/New_York',
        exchange: 'NYSE',
        minmov: 1,
        pricescale: 100,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: configurationData.supported_resolutions as ResolutionString[],
        volume_precision: 2,
        data_status: 'streaming',
      };
      
      setTimeout(() => onResolve(symbolInfo), 0);
    }
  }

  /**
   * Get historical bars
   */
  async getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: {
      from: number;
      to: number;
      countBack: number;
      firstDataRequest: boolean;
    },
    onResult: HistoryCallback,
    onError: ErrorCallback
  ): Promise<void> {
    console.log('[Datafeed] getBars:', symbolInfo.name, resolution, periodParams);
    
    const interval = resolutionToInterval[resolution] || '1d';
    const symbol = symbolInfo.name;
    
    try {
      // Use our API endpoint to get historical data
      const url = `/api/market-data/bars?symbol=${encodeURIComponent(symbol)}&interval=${interval}&from=${periodParams.from}&to=${periodParams.to}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.bars || data.bars.length === 0) {
        onResult([], { noData: true });
        return;
      }
      
      const bars: Bar[] = data.bars.map((bar: any) => ({
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume || 0
      }));
      
      // Cache the last bar for this symbol and resolution
      if (bars.length > 0) {
        const lastBar = bars[bars.length - 1];
        const subscriptionKey = `${symbol}:${resolution}`;
        this.lastBarsCache[subscriptionKey] = lastBar;
        
        // Update any active subscription
        if (this.subscriptions[symbol] && this.subscriptions[symbol].resolution === resolution) {
          this.subscriptions[symbol].lastBar = lastBar;
        }
      }
      
      onResult(bars, { noData: bars.length === 0 });
    } catch (error) {
      console.error('Error fetching bars:', error);
      
      // Generate some mock data if the API fails
      if (periodParams.firstDataRequest) {
        const mockBars = this.generateMockBars(symbolInfo.name, resolution, periodParams.from, periodParams.to, periodParams.countBack);
        
        if (mockBars.length > 0) {
          const lastBar = mockBars[mockBars.length - 1];
          const subscriptionKey = `${symbol}:${resolution}`;
          this.lastBarsCache[subscriptionKey] = lastBar;
          
          if (this.subscriptions[symbol] && this.subscriptions[symbol].resolution === resolution) {
            this.subscriptions[symbol].lastBar = lastBar;
          }
          
          onResult(mockBars, { noData: false });
          return;
        }
      }
      
      onError(`Failed to fetch bars: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate mock bars for testing or when API fails
   */
  private generateMockBars(symbol: string, resolution: string, from: number, to: number, count: number): Bar[] {
    const bars: Bar[] = [];
    const resolutionSeconds = this.getResolutionInSeconds(resolution);
    const startPrice = 100 + Math.random() * 100;
    let lastClose = startPrice;
    
    // Generate bars from 'to' and work backwards
    let currentTime = to;
    
    for (let i = 0; i < count; i++) {
      // Calculate a random price movement
      const changePercent = (Math.random() - 0.5) * 2; // -1% to +1%
      const change = lastClose * (changePercent / 100);
      
      const open = lastClose;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * Math.abs(change);
      const low = Math.min(open, close) - Math.random() * Math.abs(change);
      const volume = Math.floor(Math.random() * 10000) + 1000;
      
      bars.unshift({
        time: currentTime,
        open,
        high,
        low,
        close,
        volume
      });
      
      lastClose = close;
      currentTime -= resolutionSeconds;
      
      if (currentTime < from) break;
    }
    
    return bars;
  }
  
  /**
   * Convert resolution string to seconds
   */
  private getResolutionInSeconds(resolution: string): number {
    switch (resolution) {
      case '1': return 60;
      case '5': return 5 * 60;
      case '15': return 15 * 60;
      case '30': return 30 * 60;
      case '60': return 60 * 60;
      case '240': return 4 * 60 * 60;
      case '1D': return 24 * 60 * 60;
      case '1W': return 7 * 24 * 60 * 60;
      case '1M': return 30 * 24 * 60 * 60;
      default: return 24 * 60 * 60;
    }
  }

  /**
   * Subscribe to real-time updates
   */
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
    onResetCacheNeededCallback: () => void
  ): void {
    console.log('[Datafeed] subscribeBars:', symbolInfo.name, resolution, listenerGuid);
    
    const symbol = symbolInfo.name;
    const subscriptionKey = `${symbol}:${resolution}`;
    
    // Store the subscription
    this.subscriptions[symbol] = {
      symbolInfo,
      resolution,
      lastBar: this.lastBarsCache[subscriptionKey] || null,
      listener: onTick
    };
    
    // Subscribe to WebSocket updates if connected
    if (this.useWebSocket && this.wsConnected && this.wsConnection) {
      this.wsConnection.send(JSON.stringify({
        type: 'subscribe',
        symbol: symbol
      }));
    }
    
    // Start polling for updates
    this.startPolling(symbol, resolution, onTick);
  }

  /**
   * Start polling for updates as a fallback
   */
  private pollingIntervals: Record<string, ReturnType<typeof setInterval>> = {};
  
  private startPolling(symbol: string, resolution: ResolutionString, onTick: SubscribeBarsCallback): void {
    const interval = resolution === '1' ? 5000 : // 5 seconds for 1-minute charts
                    resolution === '5' ? 15000 : // 15 seconds for 5-minute charts
                    resolution === '15' ? 30000 : // 30 seconds for 15-minute charts
                    60000; // 1 minute for other resolutions
    
    const key = `${symbol}:${resolution}`;
    
    if (this.pollingIntervals[key]) {
      clearInterval(this.pollingIntervals[key]);
    }
    
    this.pollingIntervals[key] = setInterval(async () => {
      try {
        const sub = this.subscriptions[symbol];
        if (!sub) return;
        
        const lastBar = sub.lastBar;
        if (!lastBar) return;
        
        const lastTime = lastBar.time as number;
        const now = Math.floor(Date.now() / 1000);
        
        // Only fetch new data if enough time has passed
        const url = `/api/market-data/latest-quote?symbol=${encodeURIComponent(symbol)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          // If API call fails, generate a random price movement
          if (lastBar) {
            const change = lastBar.close * (Math.random() * 0.002 - 0.001); // -0.1% to +0.1%
            const newPrice = lastBar.close + change;
            
            // Update the last bar or create a new one
            const currentTime = this.getBarTime(resolution, now * 1000);
            
            if (lastTime === currentTime) {
              // Update existing bar
              lastBar.high = Math.max(lastBar.high, newPrice);
              lastBar.low = Math.min(lastBar.low, newPrice);
              lastBar.close = newPrice;
              
              onTick(lastBar);
            }
          }
          return;
        }
        
        const data = await response.json();
        if (!data || !data.quote || !data.quote.price) return;
        
        const price = data.quote.price;
        
        // Update the last bar or create a new one
        const currentTime = this.getBarTime(resolution, now * 1000);
        
        if (lastTime === currentTime) {
          // Update existing bar
          lastBar.high = Math.max(lastBar.high, price);
          lastBar.low = Math.min(lastBar.low, price);
          lastBar.close = price;
          
          onTick(lastBar);
        } else if (currentTime > lastTime) {
          // Create a new bar
          const newBar = {
            time: currentTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0
          };
          
          sub.lastBar = newBar;
          onTick(newBar);
        }
      } catch (error) {
        console.error('Error polling for updates:', error);
      }
    }, interval);
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeBars(listenerGuid: string): void {
    console.log('[Datafeed] unsubscribeBars:', listenerGuid);
    
    // Find the subscription by guid
    const symbol = Object.keys(this.subscriptions).find(
      (key) => `${key}:${this.subscriptions[key].resolution}` === listenerGuid
    );
    
    if (symbol) {
      // Unsubscribe from WebSocket updates
      if (this.useWebSocket && this.wsConnected && this.wsConnection) {
        this.wsConnection.send(JSON.stringify({
          type: 'unsubscribe',
          symbol: symbol
        }));
      }
      
      // Stop polling
      const key = `${symbol}:${this.subscriptions[symbol].resolution}`;
      if (this.pollingIntervals[key]) {
        clearInterval(this.pollingIntervals[key]);
        delete this.pollingIntervals[key];
      }
      
      // Remove the subscription
      delete this.subscriptions[symbol];
    }
  }

  /**
   * Get server time
   */
  getServerTime(callback: (time: number) => void): void {
    console.log('[Datafeed] getServerTime');
    // Return current time
    callback(Math.floor(Date.now() / 1000));
  }
}

// Export a singleton instance
export const tradingViewDatafeed = new TradingViewDatafeed('', false); 