'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { User } from '@supabase/supabase-js';
import AssetList from '@/components/exchange/asset-list';
import ChartView from '@/components/chart-view';
import OrderPanel from '@/components/exchange/order-panel';
import OrdersTable from '@/components/exchange/orders-table';
import BalanceDisplay from '@/components/exchange/balance-display';
import OptionsChain from '@/components/exchange/options-chain';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock } from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Define portfolio type
interface Portfolio {
  balance: {
    balance: number;
    available_balance: number;
    total_pnl: number;
    daily_pnl: number;
    weekly_pnl: number;
    monthly_pnl: number;
  };
  positions: any[];
  portfolio_summary: {
    total_portfolio_value: number;
    total_unrealized_pnl: number;
    cash_balance: number;
    total_account_value: number;
  };
}

export default function ExchangePage() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [orders, setOrders] = useState([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'stocks' | 'options'>('stocks');
  const [selectedOption, setSelectedOption] = useState<any>(null);
  const router = useRouter();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check authentication and load initial data
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Check if we have Whop authentication
        try {
          const whopResponse = await fetch('/api/user/me', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
          
          if (whopResponse.ok) {
            const whopUser = await whopResponse.json();
            console.log('Exchange: Found Whop user, Supabase sync should be in progress');
            
            // Wait a bit for sync to complete, then try again
            setTimeout(async () => {
              const { data: { session: retrySession } } = await supabase.auth.getSession();
              if (retrySession) {
                setUser(retrySession.user as User);
                await loadPortfolio();
                await loadOrders();
              }
              setLoading(false);
            }, 2000);
            return;
          }
        } catch (error) {
          console.error('Error checking Whop auth:', error);
        }
        
        console.log('Exchange: No session found, but not redirecting to prevent loop');
        setLoading(false);
        return;
      }

      if (session) {
        setUser(session.user as User);
        await loadPortfolio();
        await loadOrders();
      }
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const loadPortfolio = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch('/api/paper-trading/portfolio', { headers });
      if (response.ok) {
        const data = await response.json();
        console.log('Portfolio data loaded:', data);
        setPortfolio(data);
      } else {
        console.error('Portfolio fetch failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        
        // Set fallback portfolio data to prevent loading state
        setPortfolio({
          balance: { 
            balance: 100000, 
            available_balance: 100000, 
            total_pnl: 0, 
            daily_pnl: 0, 
            weekly_pnl: 0, 
            monthly_pnl: 0 
          },
          positions: [],
          portfolio_summary: { 
            total_portfolio_value: 0, 
            total_unrealized_pnl: 0, 
            cash_balance: 100000, 
            total_account_value: 100000 
          }
        });
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch('/api/paper-trading/orders', { headers });
      if (response.ok) {
        const data = await response.json();
        console.log('Orders loaded:', data.orders);
        setOrders(data.orders || []);
      } else {
        console.error('Failed to load orders:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Orders error details:', errorText);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const handleOrderPlaced = () => {
    // Refresh data after order is placed
    console.log('Order placed, refreshing data...');
    loadOrders();
    loadPortfolio();
  };

  const handleOrderCancelled = () => {
    // Refresh data after order is cancelled
    loadOrders();
    loadPortfolio();
  };

  const handlePriceUpdate = (price: number, change?: number, changePercent?: number) => {
    setCurrentPrice(price);
    if (change !== undefined) setPriceChange(change);
    if (changePercent !== undefined) setPriceChangePercent(changePercent);
  };

  const handleOptionSelect = (option: any) => {
    setSelectedOption(option);
    setActiveTab('options'); // Switch to options tab when an option is selected
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-bold text-white">WhopTrade Exchange</h1>
            
            {/* Clock */}
            <div className="flex items-center space-x-2 text-gray-300">
              <Clock className="w-4 h-4" />
              <div className="text-sm">
                <div className="font-medium">{formatTime(currentTime)}</div>
                <div className="text-xs text-gray-400">{formatDate(currentTime)}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Balance Display */}
            <BalanceDisplay portfolio={portfolio} />
            
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* Navigation */}
            <nav className="flex space-x-4">
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded"
              >
                Dashboard
              </button>
              <button 
                onClick={() => router.push('/leaderboard')}
                className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded"
              >
                Leaderboard
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Asset List */}
        <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
          <AssetList 
            selectedSymbol={selectedSymbol}
            onSymbolSelect={setSelectedSymbol}
            currentPrice={currentPrice}
            priceChange={priceChange}
            priceChangePercent={priceChangePercent}
          />
        </div>

        {/* Center - Chart */}
        <div className="flex-1 flex flex-col">
          <ChartView 
            symbol={selectedSymbol}
            onSymbolChange={setSelectedSymbol}
            enableTrading={false}
            onPriceUpdate={handlePriceUpdate}
          />
        </div>

        {/* Right Sidebar - Order Panel & Options */}
        <div className={`${activeTab === 'options' ? 'w-96' : 'w-80'} bg-gray-900 border-l border-gray-800 flex flex-col transition-all duration-300`}>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'stocks' | 'options')}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800 m-2">
              <TabsTrigger value="stocks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                Stocks
              </TabsTrigger>
              <TabsTrigger value="options" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                Options
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stocks" className="flex-1 flex flex-col">
              <OrderPanel 
                symbol={selectedSymbol}
                portfolio={portfolio}
                onOrderPlaced={handleOrderPlaced}
                currentPrice={currentPrice}
                assetType="stock"
              />
            </TabsContent>

            <TabsContent value="options" className="flex-1 flex flex-col">
              <div className="flex-1 overflow-hidden flex flex-col">
                <OptionsChain 
                  symbol={selectedSymbol}
                  underlyingPrice={currentPrice}
                  onOptionSelect={handleOptionSelect}
                />
                {selectedOption && (
                  <div className="mt-2">
                    <OrderPanel 
                      symbol={selectedSymbol}
                      portfolio={portfolio}
                      onOrderPlaced={handleOrderPlaced}
                      currentPrice={currentPrice}
                      selectedOption={selectedOption}
                      assetType="option"
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Bottom - Orders Table */}
      <div className="bg-gray-900 border-t border-gray-800">
        <OrdersTable 
          orders={orders}
          onOrderCancelled={handleOrderCancelled}
        />
        {/* Debug info */}
        <div className="hidden">
          Orders count: {orders.length}
        </div>
      </div>
    </div>
  );
}