import { useState, useEffect } from 'react';
import { env } from '@/app/api/env';
import { Asset, Bar, Order, Trade, Account } from '@/lib/types';

/**
 * Hook to fetch assets from the Alpaca API
 */
export function useAssets(options?: { search?: string, assetClass?: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAssets = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Build query params
        const params = new URLSearchParams();
        if (options?.search) params.append('search', options.search);
        if (options?.assetClass) params.append('class', options.assetClass);
        
        // Fetch assets
        const response = await fetch(`${env.api.alpaca.assets}?${params.toString()}`);
        if (!response.ok) throw new Error(`Failed to fetch assets: ${response.statusText}`);
        
        const data = await response.json();
        setAssets(data);
      } catch (err) {
        console.error('Error fetching assets:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssets();
  }, [options?.search, options?.assetClass]);

  return { assets, isLoading, error };
}

/**
 * Hook to fetch market data (chart bars) for a specific asset
 */
export function useMarketData(symbol: string, timeframe: string = '1D', limit: number = 100) {
  const [bars, setBars] = useState<Bar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!symbol) return;
    
    const fetchBars = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Build query params
        const params = new URLSearchParams({
          symbol,
          timeframe,
          limit: limit.toString(),
        });
        
        // Fetch market data
        const response = await fetch(`${env.api.alpaca.marketData}?${params.toString()}`);
        if (!response.ok) throw new Error(`Failed to fetch market data: ${response.statusText}`);
        
        const data = await response.json();
        setBars(data);
      } catch (err) {
        console.error('Error fetching market data:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    fetchBars();
  }, [symbol, timeframe, limit]);

  return { bars, isLoading, error };
}

/**
 * Hook to fetch orders
 */
export function useOrders(options?: { status?: string, limit?: number }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Build query params
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', options.limit.toString());
      
      // Fetch orders
      const response = await fetch(`${env.api.alpaca.orders}?${params.toString()}`);
      if (!response.ok) throw new Error(`Failed to fetch orders: ${response.statusText}`);
      
      const data = await response.json();
      setOrders(data);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [options?.status, options?.limit]);

  // Return the orders, loading state, error, and a function to refresh the orders
  return { orders, isLoading, error, refresh: fetchOrders };
}

/**
 * Hook to place an order
 */
export function usePlaceOrder() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [orderResult, setOrderResult] = useState<Order | null>(null);

  const placeOrder = async (orderData: {
    symbol: string;
    qty: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    time_in_force: 'day' | 'gtc' | 'ioc' | 'fok';
    limit_price?: string;
    stop_price?: string;
    extended_hours?: boolean;
  }) => {
    setIsLoading(true);
    setError(null);
    setOrderResult(null);
    
    try {
      // Place the order
      const response = await fetch(env.api.alpaca.orders, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      
      if (!response.ok) throw new Error(`Failed to place order: ${response.statusText}`);
      
      const data = await response.json();
      setOrderResult(data);
      return data;
    } catch (err) {
      console.error('Error placing order:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { placeOrder, isLoading, error, orderResult };
}

/**
 * Hook to cancel an order
 */
export function useCancelOrder() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cancelOrder = async (orderId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Cancel the order
      const response = await fetch(`${env.api.alpaca.orders}?order_id=${orderId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error(`Failed to cancel order: ${response.statusText}`);
      
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error canceling order:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { cancelOrder, isLoading, error };
}

/**
 * Hook to fetch account information
 */
export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccount = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch account
      const response = await fetch(env.api.alpaca.account);
      if (!response.ok) throw new Error(`Failed to fetch account: ${response.statusText}`);
      
      const data = await response.json();
      setAccount(data);
    } catch (err) {
      console.error('Error fetching account:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  return { account, isLoading, error, refresh: fetchAccount };
}

/**
 * Hook to manage local storage state with a React state
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Get from local storage by key
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        // Parse stored json or if none return initialValue
        return item ? JSON.parse(item) : initialValue;
      }
      return initialValue;
    } catch (error) {
      // If error also return initialValue
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.error('Error writing to localStorage:', error);
    }
  };

  return [storedValue, setValue] as const;
} 