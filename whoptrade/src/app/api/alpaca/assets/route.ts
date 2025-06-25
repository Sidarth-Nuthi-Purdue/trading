import { NextRequest, NextResponse } from 'next/server';
import { getAssets } from '@/lib/alpaca-broker-api';
import { z } from 'zod';

const assetsSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  asset_class: z.string().optional(),
  exchange: z.string().optional(),
});

export const dynamic = 'force-dynamic';

// Alpaca API credentials and URLs
const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
const ALPACA_API_URL = 'https://paper-api.alpaca.markets';

// Mock assets for demo purposes
const mockAssets = [
  {
    id: '904837e3-3b76-47ec-b432-046db621571b',
    class: 'us_equity',
    exchange: 'NASDAQ',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: '4ce9353c-66d1-46c2-898f-fce68e59e9bd',
    class: 'us_equity',
    exchange: 'NASDAQ',
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: 'bb2a26c0-4c77-4801-8afc-82e8142ac7b8',
    class: 'us_equity',
    exchange: 'NASDAQ',
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: '24cbba8c-831b-44e2-8503-dd0c2ed7af8f',
    class: 'us_equity',
    exchange: 'NASDAQ',
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: 'c4c7fd7e-c8cb-4b58-b756-603c3e1e39c6',
    class: 'us_equity',
    exchange: 'NASDAQ',
    symbol: 'GOOGL',
    name: 'Alphabet Inc. - Class A',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: '12f4b553-3628-4604-9a17-1d0b73ef679c',
    class: 'us_equity',
    exchange: 'NASDAQ',
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: '93b8bd0c-f1a4-4b17-8d1c-9b1764e6274c',
    class: 'us_equity',
    exchange: 'NYSE',
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: '88a2b4b0-c40c-4bed-9526-7f55937b7d38',
    class: 'us_equity',
    exchange: 'NASDAQ',
    symbol: 'AMD',
    name: 'Advanced Micro Devices, Inc.',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: '5dbdd25e-0286-4bf3-ab9a-5e34b2017a7c',
    class: 'us_equity',
    exchange: 'NYSE',
    symbol: 'DIS',
    name: 'The Walt Disney Company',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  },
  {
    id: '4cd3a894-57c9-4c42-b75f-ebea5f25b641',
    class: 'us_equity',
    exchange: 'NYSE',
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co.',
    status: 'active',
    tradable: true,
    marginable: true,
    shortable: true,
    easy_to_borrow: true,
    fractionable: true
  }
];

/**
 * GET handler for fetching assets
 */
export async function GET(req: NextRequest) {
  try {
    // Get search query from URL parameters
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get('search')?.toLowerCase() || '';
    
    if (!searchQuery) {
      return NextResponse.json({ assets: [] });
    }
    
    // Option 1: Use mock data (for development/demo)
    const filteredAssets = mockAssets.filter(asset => 
      asset.symbol.toLowerCase().includes(searchQuery) || 
      asset.name.toLowerCase().includes(searchQuery)
    );
    
    return NextResponse.json({ assets: filteredAssets });
    
    // Option 2: Use actual Alpaca API (uncomment to use)
    /*
    if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
      console.error('Alpaca API credentials not configured');
      return NextResponse.json({ error: 'API credentials not configured' }, { status: 500 });
    }
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('status', 'active');
    
    const response = await fetch(`${ALPACA_API_URL}/v2/assets?${queryParams.toString()}`, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Alpaca API error:', errorText);
      throw new Error(`Failed to fetch assets: ${response.status}`);
    }
    
    const assets = await response.json();
    
    // Filter assets based on search query
    const filteredAssets = assets.filter((asset: any) => 
      asset.symbol.toLowerCase().includes(searchQuery) || 
      (asset.name && asset.name.toLowerCase().includes(searchQuery))
    );
    
    // Limit to top 10 matches
    const limitedAssets = filteredAssets.slice(0, 10);
    
    return NextResponse.json({ assets: limitedAssets });
    */
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 