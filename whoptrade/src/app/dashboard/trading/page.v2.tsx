'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ChartView from '@/components/chart-view';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTheme } from 'next-themes';
import { RefreshCw, Moon, Sun, AlertTriangle } from 'lucide-react';
import OrderForm from '@/components/order-form';
import OrdersDisplay, { Order as DisplayOrder } from '@/components/orders-display';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/auth-provider';
import { SetupRequiredAlert } from '@/components/ui/setup-required-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// Type definitions
interface TradingAccount {
  id: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
}

interface Position {
    symbol: string;
    unrealized_pl: string;
    unrealized_intraday_pl: string;
}

// Format currency
const formatCurrency = (value: number | string | null | undefined) => {
  const numValue = parseFloat(String(value));
  return isNaN(numValue) ? '$0.00' : numValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

// Loading Skeleton
const DashboardSkeleton = () => (
    <div className="flex h-screen bg-background p-4 animate-pulse">
        <main className="flex-1 flex flex-col space-y-4"><header className="flex items-center justify-between"><Skeleton className="h-8 w-64" /><div className="flex items-center space-x-4"><Skeleton className="h-6 w-48" /><Skeleton className="h-8 w-8 rounded-full" /></div></header><Card><CardContent className="p-4 grid grid-cols-6 gap-4">{Array(6).fill(0).map((_, i) => (<div key={i} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-32" /></div>))}</CardContent></Card><Skeleton className="flex-1" /><Skeleton className="h-48 w-full" /></main>
        <aside className="w-96 border-l p-4 space-y-4"><Skeleton className="h-72 w-full" /><Skeleton className="flex-1 w-full" /></aside>
    </div>
);

// Main Component
export default function TradingDashboardV2() {
    const { user, loading: authLoading } = useSupabase();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    
    const [tradingAccount, setTradingAccount] = useState<TradingAccount | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<{ message: string; details?: string; setupRequired?: boolean } | null>(null);
    
    const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
    const [currentPrice, setCurrentPrice] = useState(175.0); // Placeholder
    const [orders, setOrders] = useState<DisplayOrder[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);

    const portfolioData = useMemo(() => {
        if (!tradingAccount) return null;
        return {
            ...tradingAccount,
            totalPnL: positions.reduce((acc, pos) => acc + parseFloat(pos.unrealized_pl || '0'), 0),
            dayPnL: positions.reduce((acc, pos) => acc + parseFloat(pos.unrealized_intraday_pl || '0'), 0),
        };
    }, [tradingAccount, positions]);

    const fetchAllData = useCallback(async () => {
        try {
            const [accountRes, ordersRes, positionsRes] = await Promise.all([
                fetch('/api/trading/account'),
                fetch('/api/trading/orders'),
                fetch('/api/trading/positions'),
            ]);

            const accountData = await accountRes.json();
            if (!accountRes.ok) throw accountData;
            setTradingAccount(accountData.account);
            localStorage.setItem('tradingAccount', JSON.stringify(accountData.account));

            if (ordersRes.ok) {
                const ordersData = await ordersRes.json();
                setOrders(ordersData.map((o: any): DisplayOrder => ({ ...o, price: parseFloat(o.limit_price || o.stop_price || '0'), quantity: parseFloat(o.qty), createdAt: new Date(o.created_at) })));
            }
            if (positionsRes.ok) setPositions(await positionsRes.json());

            setError(null);
        } catch (err: any) {
            const cachedAccount = localStorage.getItem('tradingAccount');
            if (cachedAccount) {
                setTradingAccount(JSON.parse(cachedAccount));
                toast.warning("Displaying cached data due to API error.");
            } else {
                setError({ message: err.error || 'Failed to fetch account', details: err.details, setupRequired: err.setupRequired });
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (user) {
                fetchAllData();
                const interval = setInterval(fetchAllData, 30000);
                return () => clearInterval(interval);
            } else {
                router.push('/login');
            }
        }
    }, [user, authLoading, router, fetchAllData]);

    if (authLoading || loading) return <DashboardSkeleton />;

    if (error) {
        if (error.setupRequired) return <SetupRequiredAlert error={error.message} details={error.details} />;
        return (
            <div className="flex flex-col items-center justify-center h-screen text-center p-4">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2 text-red-600">{error.message}</h2>
                <p className="text-muted-foreground max-w-md mb-6">{error.details}</p>
                <Button onClick={fetchAllData}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
            </div>
        );
    }

    if (!tradingAccount) return <div className="flex items-center justify-center h-screen">No account data.</div>;

    return (
        <div className="flex h-screen bg-background text-foreground">
            <main className="flex-1 flex flex-col p-4 space-y-4">
                <header className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Trading Dashboard</h1>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-muted-foreground">{new Date().toLocaleString()}</span>
                        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun /> : <Moon />}</Button>
                    </div>
                </header>

                <Card>
                    <CardContent className="p-4 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                        <div><p className="text-muted-foreground">Portfolio Value</p><p className="font-semibold text-lg">{formatCurrency(portfolioData?.portfolio_value)}</p></div>
                        <div><p className="text-muted-foreground">Buying Power</p><p className="font-semibold text-lg">{formatCurrency(portfolioData?.buying_power)}</p></div>
                        <div><p className="text-muted-foreground">Cash</p><p className="font-semibold text-lg">{formatCurrency(portfolioData?.cash)}</p></div>
                        <div><p className="text-muted-foreground">Today's P/L</p><p className={`font-semibold text-lg ${(portfolioData?.dayPnL ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(portfolioData?.dayPnL)}</p></div>
                        <div><p className="text-muted-foreground">Total P/L</p><p className={`font-semibold text-lg ${(portfolioData?.totalPnL ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(portfolioData?.totalPnL)}</p></div>
                        <div><p className="text-muted-foreground">Status</p><Badge variant={tradingAccount.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-lg">{tradingAccount.status}</Badge></div>
                    </CardContent>
                </Card>

                <div className="flex-1"><ChartView symbol={selectedSymbol} /></div>

                <Tabs defaultValue="positions" className="w-full">
                    <TabsList>
                        <TabsTrigger value="positions">Positions ({positions.length})</TabsTrigger>
                        <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="positions">{/* Positions Table */}</TabsContent>
                    <TabsContent value="orders"><OrdersDisplay orders={orders} onCancelOrder={() => {}} onRefreshOrders={fetchAllData} /></TabsContent>
                </Tabs>
            </main>
            <aside className="w-96 border-l p-4 space-y-4 overflow-y-auto">
                <OrderForm symbol={selectedSymbol} currentPrice={currentPrice} />
                <Card><CardHeader><CardTitle>Watchlist</CardTitle></CardHeader><CardContent>{/* Watchlist here */}</CardContent></Card>
            </aside>
        </div>
    );
} 