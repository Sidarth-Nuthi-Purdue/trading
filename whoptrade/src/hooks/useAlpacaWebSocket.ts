'use client';

import { useEffect, useState, useRef } from 'react';

export type DataType = 'trades' | 'quotes' | 'bars';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
}

export function useAlpacaWebSocket(symbol: string, dataType: DataType = 'trades') {
  const [data, setData] = useState<MarketData | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (typeof window === 'undefined' || !symbol) return;
    
    // Connect to WebSocket
    const connect = () => {
      try {
        setStatus('connecting');
        const wsUrl = 'wss://stream.data.sandbox.alpaca.markets/v2/iex';
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          setStatus('connected');
          
          // Authenticate
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const authMsg = JSON.stringify({
              action: 'auth',
              key: process.env.NEXT_PUBLIC_ALPACA_API_KEY || 'PKFN69V0XUS87FC3T9VL',
              secret: process.env.NEXT_PUBLIC_ALPACA_API_SECRET || 'vWfbFQrRN0XdKqHsOj67lkWHflODsjblPR93GosQ'
            });
            wsRef.current.send(authMsg);
            
            // Subscribe
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
            
            if (!Array.isArray(messages)) return;
            
            for (const msg of messages) {
              // Process data based on type
              if ((dataType === 'trades' && msg.T === 't') || 
                  (dataType === 'quotes' && msg.T === 'q') ||
                  (dataType === 'bars' && msg.T === 'b')) {
                
                if (msg.S?.toUpperCase() === symbol.toUpperCase()) {
                  setData({
                    symbol: msg.S,
                    price: dataType === 'quotes' ? parseFloat(msg.bp) : parseFloat(msg.p || msg.c),
                    timestamp: new Date(msg.t).getTime(),
                    ...(msg.o && { open: parseFloat(msg.o) }),
                    ...(msg.h && { high: parseFloat(msg.h) }),
                    ...(msg.l && { low: parseFloat(msg.l) }),
                    ...(msg.v && { volume: parseInt(msg.v) })
                  });
                }
              }
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        wsRef.current.onclose = () => {
          setStatus('disconnected');
          reconnect();
        };
        
        wsRef.current.onerror = (event) => {
          console.error('WebSocket error:', event);
          setStatus('error');
          setError('Connection error');
        };
      } catch (error) {
        console.error('Error establishing WebSocket connection:', error);
        setStatus('error');
        setError('Failed to connect');
      }
    };
    
    // Reconnect logic
    const reconnect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      reconnectTimerRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };
    
    connect();
    
    // Cleanup
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      if (wsRef.current) {
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
  
  return { data, status, error };
}

export default useAlpacaWebSocket; 