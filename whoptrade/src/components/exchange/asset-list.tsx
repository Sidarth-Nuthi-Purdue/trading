'use client';

import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Asset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: string;
  previousClose?: number;
}

interface AssetListProps {
  selectedSymbol: string;
  onSymbolSelect: (symbol: string) => void;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
}

// Base asset data with static info - prices will be fetched dynamically
const POPULAR_STOCKS_BASE = [
  { symbol: 'AAPL', name: 'Apple Inc.', volume: 45123456, marketCap: '2.8T' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', volume: 32456789, marketCap: '2.5T' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', volume: 28765432, marketCap: '1.3T' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', volume: 23456781, marketCap: '1.7T' },
  { symbol: 'META', name: 'Meta Platforms', volume: 19876543, marketCap: '740B' },
  { symbol: 'TSLA', name: 'Tesla Inc.', volume: 67890123, marketCap: '780B' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', volume: 45678901, marketCap: '1.0T' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', volume: 34567890, marketCap: '250B' },
  { symbol: 'INTC', name: 'Intel Corp.', volume: 23456789, marketCap: '190B' },
  { symbol: 'NFLX', name: 'Netflix Inc.', volume: 12345678, marketCap: '180B' },
  { symbol: 'CRM', name: 'Salesforce Inc.', volume: 15678901, marketCap: '210B' },
  { symbol: 'ORCL', name: 'Oracle Corp.', volume: 18901234, marketCap: '290B' },
  { symbol: 'BABA', name: 'Alibaba Group', volume: 25678901, marketCap: '230B' },
  { symbol: 'UBER', name: 'Uber Technologies', volume: 21234567, marketCap: '110B' },
  { symbol: 'SPOT', name: 'Spotify Technology', volume: 8901234, marketCap: '28B' }
];

const ETF_LIST_BASE = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', volume: 89012345 },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', volume: 45678901 },
  { symbol: 'IWM', name: 'iShares Russell 2000', volume: 23456789 },
  { symbol: 'VTI', name: 'Vanguard Total Stock', volume: 12345678 },
  { symbol: 'GLD', name: 'SPDR Gold Shares', volume: 8901234 },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury', volume: 15678901 }
];

export default function AssetList({ selectedSymbol, onSymbolSelect, currentPrice, priceChange, priceChangePercent }: AssetListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'stocks' | 'etfs'>('stocks');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch latest prices from chart data endpoint for consistency
  const fetchQuotes = async (symbols: string[]) => {
    try {
      const quotePromises = symbols.map(async (symbol) => {
        const response = await fetch(`/api/market-data/bars?symbol=${symbol}&interval=1d`);
        if (response.ok) {
          const data = await response.json();
          const bars = data.bars || [];
          if (bars.length > 0) {
            const latestBar = bars[bars.length - 1];
            const currentPrice = latestBar.close;
            const previousPrice = bars.length > 1 ? bars[bars.length - 2].close : currentPrice;
            const change = currentPrice - previousPrice;
            const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;
            
            return {
              symbol,
              price: currentPrice,
              change: change,
              changePercent: changePercent,
              previousClose: previousPrice
            };
          }
        }
        return { symbol, price: 0, change: 0, changePercent: 0, previousClose: 0 };
      });
      
      const quotes = await Promise.all(quotePromises);
      return quotes;
    } catch (error) {
      console.error('Error fetching quotes:', error);
      return symbols.map(symbol => ({ symbol, price: 0, change: 0, changePercent: 0, previousClose: 0 }));
    }
  };

  // Load assets with real-time quotes
  const loadAssets = async () => {
    setLoading(true);
    const baseData = activeTab === 'stocks' ? POPULAR_STOCKS_BASE : ETF_LIST_BASE;
    const symbols = baseData.map(asset => asset.symbol);
    
    const quotes = await fetchQuotes(symbols);
    
    const assetsWithQuotes: Asset[] = baseData.map(base => {
      const quote = quotes.find(q => q.symbol === base.symbol);
      return {
        ...base,
        price: quote?.price || 0,
        change: quote?.change || 0,
        changePercent: quote?.changePercent || 0,
        previousClose: quote?.previousClose || 0
      };
    });
    
    setAssets(assetsWithQuotes);
    setLoading(false);
  };

  useEffect(() => {
    loadAssets();
  }, [activeTab]);

  // Refresh quotes every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadAssets, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const filteredAssets = assets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-3">Markets</h2>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search symbols..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('stocks')}
            className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'stocks'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Stocks
          </button>
          <button
            onClick={() => setActiveTab('etfs')}
            className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'etfs'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ETFs
          </button>
        </div>
      </div>

      {/* Asset List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          filteredAssets.map((asset) => {
            // Use live price for selected symbol, fallback to asset price
            const displayPrice = selectedSymbol === asset.symbol && currentPrice ? currentPrice : asset.price;
            const displayChange = selectedSymbol === asset.symbol && priceChange !== undefined ? priceChange : asset.change;
            const displayChangePercent = selectedSymbol === asset.symbol && priceChangePercent !== undefined ? priceChangePercent : asset.changePercent;
            
            return (
              <div
                key={asset.symbol}
                onClick={() => onSymbolSelect(asset.symbol)}
                className={`p-3 border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-800 ${
                  selectedSymbol === asset.symbol ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white">{asset.symbol}</span>
                    {displayChange > 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                  <span className="text-white font-medium">${formatPrice(displayPrice)}</span>
                </div>
                
                <div className="text-xs text-gray-400 mb-1 truncate">
                  {asset.name}
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium ${
                    displayChange > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {displayChange > 0 ? '+' : ''}{displayChange.toFixed(2)} ({displayChangePercent.toFixed(2)}%)
                  </span>
                  <span className="text-gray-500">
                    Vol: {formatVolume(asset.volume)}
                  </span>
                </div>
                
                {asset.marketCap && (
                  <div className="text-xs text-gray-500 mt-1">
                    Cap: {asset.marketCap}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}