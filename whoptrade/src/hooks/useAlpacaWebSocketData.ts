'use client';

import { useEffect, useState, useRef } from 'react';

// Define the market data interface
export interface MarketDataUpdate {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
}

// Define WebSocket connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Custom hook for subscribing to Alpaca WebSocket market data
 * @param symbol Stock symbol to track
 * @param dataType Type of market data to receive (trades, quotes, or bars)
 * @returns Current market data and connection status
 */
export function useAlpacaWebSocketData(
  symbol: string,
  dataType: 'trades' | 'quotes' | 'bars' = 'trades'
): {
  data: MarketDataUpdate | null;
  status: ConnectionStatus;
  connectionError: string | null;
} {
  const [data, setData] = useState<MarketDataUpdate | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (typeof window === 'undefined' || !symbol) return;
    
    // Helper function to connect to WebSocket
    const connect = () => {
      try {
        setStatus('connecting');
        
        // Sandbox WebSocket endpoint
        const wsUrl = 'wss://stream.data.sandbox.alpaca.markets/v2/iex';
        wsRef.current = new WebSocket(wsUrl);
        
        // Setup event handlers
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          setStatus('connected');
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
          
          // Authenticate
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const authMsg = JSON.stringify({
              action: 'auth',
              key: process.env.NEXT_PUBLIC_ALPACA_API_KEY || 'PKFN69V0XUS87FC3T9VL',
              secret: process.env.NEXT_PUBLIC_ALPACA_API_SECRET || 'vWfbFQrRN0XdKqHsOj67lkWHflODsjblPR93GosQ'
            });
            wsRef.current.send(authMsg);
            
            // Subscribe to the data feed
            const subscribeMsg = JSON.stringify({
              action: 'subscribe',
              [dataType]: [symbol]
            });
            wsRef.current.send(subscribeMsg);
          }
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const messages = JSON.parse(event.data);
            
            if (!Array.isArray(messages)) {
              console.log('Non-array message:', messages);
              return;
            }
            
            for (const msg of messages) {
              // Authentication successful
              if (msg.T === 'success' && msg.msg === 'authenticated') {
                console.log('WebSocket authenticated');
                continue;
              }
              
              // Subscription update
              if (msg.T === 'subscription') {
                console.log('Subscription update:', msg);
                continue;
              }
              
              // Error message
              if (msg.T === 'error') {
                console.error('WebSocket error:', msg);
                setConnectionError(msg.msg || 'Unknown error');
                continue;
              }
              
              // Process data based on type
              if (dataType === 'trades' && msg.T === 't') {
                if (msg.S.toUpperCase() === symbol.toUpperCase()) {
                  setData({
                    symbol: msg.S,
                    price: parseFloat(msg.p),
                    timestamp: new Date(msg.t).getTime(),
                    volume: parseInt(msg.v),
                  });
                }
              } else if (dataType === 'quotes' && msg.T === 'q') {
                if (msg.S.toUpperCase() === symbol.toUpperCase()) {
                  setData({
                    symbol: msg.S,
                    price: parseFloat(msg.bp), // Use bid price
                    timestamp: new Date(msg.t).getTime(),
                  });
                }
              } else if (dataType === 'bars' && msg.T === 'b') {
                if (msg.S.toUpperCase() === symbol.toUpperCase()) {
                  setData({
                    symbol: msg.S,
                    price: parseFloat(msg.c),
                    open: parseFloat(msg.o),
                    high: parseFloat(msg.h),
                    low: parseFloat(msg.l),
                    timestamp: new Date(msg.t).getTime(),
                    volume: parseInt(msg.v),
                  });
                }
              }
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        wsRef.current.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          setStatus('disconnected');
          
          // Attempt reconnection
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptsRef.current));
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              connect();
            }, delay);
          } else {
            setConnectionError('Maximum reconnection attempts reached');
          }
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setStatus('error');
          setConnectionError('Connection error occurred');
        };
      } catch (error) {
        console.error('Error establishing WebSocket connection:', error);
        setStatus('error');
        setConnectionError('Failed to establish connection');
      }
    };
    
    // Connect on mount
    connect();
    
    // Cleanup on unmount
    return () => {
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Close WebSocket connection
      if (wsRef.current) {
        // Unsubscribe before closing
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            const unsubscribeMsg = JSON.stringify({
              action: 'unsubscribe',
              [dataType]: [symbol]
            });
            wsRef.current.send(unsubscribeMsg);
          } catch (error) {
            console.error('Error unsubscribing:', error);
          }
        }
        
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol, dataType]);

  return { data, status, connectionError };
}

export default useAlpacaWebSocketData; 