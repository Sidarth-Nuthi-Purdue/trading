import React from 'react';
import { 
  Search,
  ArrowDown,
  ArrowUp,
  Star,
  StarOff,
  PlusCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Asset } from '@/lib/types';

interface AssetListProps {
  assets: Asset[];
  selectedAsset: string;
  onSelectAsset: (symbol: string) => void;
  isLoading?: boolean;
}

export function AssetList({
  assets,
  selectedAsset,
  onSelectAsset,
  isLoading = false
}: AssetListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [favorites, setFavorites] = React.useState<string[]>(['AAPL', 'BTC/USD']);
  const [activeTab, setActiveTab] = React.useState('all');
  const [customInput, setCustomInput] = React.useState('');
  
  // Filter assets based on search and active tab
  const filteredAssets = React.useMemo(() => {
    let filtered = [...assets];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.symbol.toLowerCase().includes(term) || 
        asset.name.toLowerCase().includes(term)
      );
    }
    
    // Filter by tab
    if (activeTab === 'favorites') {
      filtered = filtered.filter(asset => favorites.includes(asset.symbol));
    } else if (activeTab === 'stocks') {
      filtered = filtered.filter(asset => asset.class === 'us_equity');
    } else if (activeTab === 'crypto') {
      filtered = filtered.filter(asset => asset.class === 'crypto');
    } else if (activeTab === 'forex') {
      filtered = filtered.filter(asset => asset.class === 'forex');
    }
    
    return filtered;
  }, [assets, searchTerm, favorites, activeTab]);
  
  // Toggle favorite status for an asset
  const toggleFavorite = (symbol: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    setFavorites(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCustomInput(value);
  };

  // Handle key press to add custom asset
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customInput && !assets.some(a => a.symbol.toLowerCase() === customInput.toLowerCase())) {
      // If it's a valid stock symbol format (at least 1 character)
      if (customInput.trim().length >= 1) {
        onSelectAsset(customInput.toUpperCase().trim());
        setSearchTerm('');
        setCustomInput('');
      }
    }
  };

  // Handle adding custom asset
  const handleAddCustomAsset = () => {
    if (customInput && !assets.some(a => a.symbol.toLowerCase() === customInput.toLowerCase())) {
      if (customInput.trim().length >= 1) {
        onSelectAsset(customInput.toUpperCase().trim());
        setSearchTerm('');
        setCustomInput('');
      }
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header and Search */}
      <div className="p-3 border-b border-border/40">
        <h2 className="text-lg font-bold mb-3">Markets</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search or enter symbol..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyPress}
            className="pl-9 h-9 text-sm rounded-lg bg-background"
          />
          {customInput && !assets.some(a => a.symbol.toLowerCase() === customInput.toLowerCase()) && (
            <div className="absolute right-2 top-1.5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleAddCustomAsset}
                className="h-6 w-6 rounded-full"
              >
                <PlusCircle className="h-4 w-4 text-primary" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 h-10 bg-transparent p-0">
          <TabsTrigger 
            value="all" 
            className="text-xs rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary h-full"
          >
            All
          </TabsTrigger>
          <TabsTrigger 
            value="favorites" 
            className="text-xs rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary h-full"
          >
            <Star className="h-3 w-3 mr-1" />
          </TabsTrigger>
          <TabsTrigger 
            value="stocks" 
            className="text-xs rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary h-full"
          >
            Stocks
          </TabsTrigger>
          <TabsTrigger 
            value="crypto" 
            className="text-xs rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary h-full"
          >
            Crypto
          </TabsTrigger>
          <TabsTrigger 
            value="forex" 
            className="text-xs rounded-none data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary h-full"
          >
            Forex
          </TabsTrigger>
        </TabsList>
        
        {/* Asset List Content */}
        <TabsContent value={activeTab} className="flex-1 overflow-y-auto mt-0 p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
              <Search className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No assets found matching your criteria.</p>
              {searchTerm && (
                <div className="mt-2 flex flex-col items-center">
                  <button 
                    className="text-primary text-xs"
                    onClick={() => setSearchTerm('')}
                  >
                    Clear search
                  </button>
                  <div className="mt-4">
                    <p className="text-sm mb-2">Looking for "{searchTerm.toUpperCase()}"?</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        onSelectAsset(searchTerm.toUpperCase());
                        setSearchTerm('');
                      }}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add "{searchTerm.toUpperCase()}"
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredAssets.map((asset) => (
                <div 
                  key={asset.symbol}
                  onClick={() => onSelectAsset(asset.symbol)}
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedAsset === asset.symbol ? 'bg-muted/70' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => toggleFavorite(asset.symbol, e)}
                      className="h-6 w-6 flex items-center justify-center text-yellow-500 hover:bg-muted rounded-full transition-colors"
                    >
                      {favorites.includes(asset.symbol) ? (
                        <Star className="h-4 w-4 fill-yellow-500" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </button>
                    <div>
                      <div className="font-medium">{asset.symbol}</div>
                      <div className="text-xs text-muted-foreground">{asset.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className={`text-xs flex items-center justify-end ${asset.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {asset.change >= 0 ? (
                        <ArrowUp className="h-3 w-3 mr-1" />
                      ) : (
                        <ArrowDown className="h-3 w-3 mr-1" />
                      )}
                      {Math.abs(asset.change)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 