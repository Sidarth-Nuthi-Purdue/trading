import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Process Alpaca options data into our format
 */
function processAlpacaOptionsData(optionsContracts: any[], optionsBars: any, optionsQuotes: any, underlyingPrice: number, symbol: string) {
  const expirationMap = new Map();
  const strikes = new Set<number>();
  
  optionsContracts.forEach((contract: any) => {
    const expDate = contract.expiration_date;
    if (!expirationMap.has(expDate)) {
      expirationMap.set(expDate, { calls: [], puts: [] });
    }
    
    // Convert strike price to number
    const strikePrice = parseFloat(contract.strike_price);
    
    // Filter out strikes that are too far out of the money
    const priceDiff = Math.abs(strikePrice - underlyingPrice);
    const maxDiff = underlyingPrice * 0.5; // Only show strikes within 50% of current price
    if (priceDiff > maxDiff) {
      return; // Skip this contract
    }
    
    strikes.add(strikePrice);
    
    // Get pricing data for this contract
    const bars = optionsBars[contract.symbol] || [];
    const latestBar = bars.length > 0 ? bars[bars.length - 1] : null;
    
    // Get quote data for this contract
    const quote = optionsQuotes[contract.symbol];
    
    // Calculate estimated bid/ask if not available
    const lastPrice = latestBar?.c || parseFloat(contract.close_price) || 0;
    const bidPrice = quote?.bp || (lastPrice > 0 ? Math.max(0.01, lastPrice - 0.05) : 0);
    const askPrice = quote?.ap || (lastPrice > 0 ? lastPrice + 0.05 : 0);
    
    const optionData = {
      contractSymbol: contract.symbol,
      strike: strikePrice,
      lastPrice: lastPrice,
      bid: bidPrice,
      ask: askPrice,
      volume: latestBar?.v || 0,
      openInterest: parseInt(contract.open_interest) || 0,
      impliedVolatility: 0, // Would need separate API call
      inTheMoney: contract.type === 'call' 
        ? underlyingPrice > strikePrice 
        : underlyingPrice < strikePrice,
      change: 0, // Would need to calculate from previous close
      percentChange: 0,
      lastTradeDate: latestBar?.t || quote?.t || contract.close_price_date || Date.now()
    };
    
    if (contract.type === 'call') {
      expirationMap.get(expDate).calls.push(optionData);
    } else {
      expirationMap.get(expDate).puts.push(optionData);
    }
  });

  // Get the nearest expiration date
  const sortedExpirations = Array.from(expirationMap.keys()).sort();
  const nearestExpiration = sortedExpirations[0];
  
  return {
    symbol,
    underlyingPrice,
    expirationDates: sortedExpirations.map((dateStr: string) => {
      const date = new Date(dateStr);
      return {
        timestamp: Math.floor(date.getTime() / 1000),
        date: dateStr,
        daysToExpiry: Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      };
    }),
    strikes: Array.from(strikes).sort((a, b) => a - b),
    options: nearestExpiration ? expirationMap.get(nearestExpiration) : { calls: [], puts: [] }
  };
}

/**
 * Process Alpha Vantage options data into our format
 */
function processAlphaVantageOptionsData(optionsData: any, underlyingPrice: number, symbol: string) {
  const expirationMap = new Map();
  const strikes = new Set<number>();
  
  // Alpha Vantage returns data in a different format
  Object.keys(optionsData).forEach(dateKey => {
    if (dateKey === 'Meta Data') return;
    
    const expDate = dateKey;
    if (!expirationMap.has(expDate)) {
      expirationMap.set(expDate, { calls: [], puts: [] });
    }
    
    const contracts = optionsData[dateKey];
    
    Object.keys(contracts).forEach(contractKey => {
      const contract = contracts[contractKey];
      const strike = parseFloat(contract.strike);
      strikes.add(strike);
      
      const optionData = {
        contractSymbol: contractKey,
        strike: strike,
        lastPrice: parseFloat(contract.last_trading_day) || parseFloat(contract.bid) || parseFloat(contract.ask) || 0,
        bid: parseFloat(contract.bid) || 0,
        ask: parseFloat(contract.ask) || 0,
        volume: parseInt(contract.volume) || 0,
        openInterest: parseInt(contract.open_interest) || 0,
        impliedVolatility: parseFloat(contract.implied_volatility) || 0,
        inTheMoney: contract.type === 'call' 
          ? underlyingPrice > strike 
          : underlyingPrice < strike,
        change: parseFloat(contract.change) || 0,
        percentChange: parseFloat(contract.change_percent) || 0,
        lastTradeDate: Date.now()
      };
      
      if (contract.type === 'call') {
        expirationMap.get(expDate).calls.push(optionData);
      } else {
        expirationMap.get(expDate).puts.push(optionData);
      }
    });
  });

  // Get the nearest expiration date
  const sortedExpirations = Array.from(expirationMap.keys()).sort();
  const nearestExpiration = sortedExpirations[0];
  
  return {
    symbol,
    underlyingPrice,
    expirationDates: sortedExpirations.map((dateStr: string) => {
      const date = new Date(dateStr);
      return {
        timestamp: Math.floor(date.getTime() / 1000),
        date: dateStr,
        daysToExpiry: Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      };
    }),
    strikes: Array.from(strikes).sort((a, b) => a - b),
    options: nearestExpiration ? expirationMap.get(nearestExpiration) : { calls: [], puts: [] }
  };
}

/**
 * Legacy function for backward compatibility
 */
function processPolygonOptionsData(optionsContracts: any[], optionsSnapshots: any[], underlyingPrice: number, symbol: string) {
  // Create a map of snapshots by contract symbol for fast lookup
  const snapshotMap = new Map();
  optionsSnapshots.forEach((snapshot: any) => {
    snapshotMap.set(snapshot.value?.underlying_ticker || snapshot.name, snapshot);
  });

  // Group options by expiration date
  const expirationMap = new Map();
  const strikes = new Set<number>();
  
  optionsContracts.forEach((contract: any) => {
    const expDate = contract.expiration_date;
    if (!expirationMap.has(expDate)) {
      expirationMap.set(expDate, { calls: [], puts: [] });
    }
    
    strikes.add(contract.strike_price);
    
    // Get snapshot data for this contract
    const snapshot = snapshotMap.get(contract.ticker) || {};
    const marketData = snapshot.value || {};
    
    // Calculate estimated pricing based on intrinsic value for demonstration
    const isCall = contract.contract_type === 'call';
    const isITM = isCall ? underlyingPrice > contract.strike_price : underlyingPrice < contract.strike_price;
    
    let intrinsicValue = 0;
    if (isITM) {
      intrinsicValue = isCall 
        ? Math.max(0, underlyingPrice - contract.strike_price)
        : Math.max(0, contract.strike_price - underlyingPrice);
    }
    
    // Add some time value based on how close to ATM
    const distanceFromATM = Math.abs(underlyingPrice - contract.strike_price);
    const timeValue = Math.max(0.05, 2 - (distanceFromATM / 10)); // Rough time value estimate
    
    const estimatedPrice = intrinsicValue + (isITM ? timeValue * 0.5 : timeValue);
    const bid = Math.max(0.01, estimatedPrice - 0.05);
    const ask = estimatedPrice + 0.05;
    
    const optionData = {
      contractSymbol: contract.ticker,
      strike: contract.strike_price,
      lastPrice: marketData.last_quote?.ask || marketData.last_quote?.bid || marketData.last_trade?.price || estimatedPrice,
      bid: marketData.last_quote?.bid || bid,
      ask: marketData.last_quote?.ask || ask,
      volume: marketData.last_trade?.size || Math.floor(Math.random() * 1000) + 100,
      openInterest: marketData.open_interest || Math.floor(Math.random() * 5000) + 500,
      impliedVolatility: marketData.implied_volatility || (0.15 + Math.random() * 0.25),
      inTheMoney: isITM,
      change: marketData.change || (Math.random() - 0.5) * 0.5,
      percentChange: marketData.change_percent || (Math.random() - 0.5) * 10,
      lastTradeDate: marketData.last_trade?.participant_timestamp || Date.now()
    };
    
    if (contract.contract_type === 'call') {
      expirationMap.get(expDate).calls.push(optionData);
    } else {
      expirationMap.get(expDate).puts.push(optionData);
    }
  });

  // Get the nearest expiration date
  const sortedExpirations = Array.from(expirationMap.keys()).sort();
  const nearestExpiration = sortedExpirations[0];
  
  return {
    symbol,
    underlyingPrice,
    expirationDates: sortedExpirations.map((dateStr: string) => {
      const date = new Date(dateStr);
      return {
        timestamp: Math.floor(date.getTime() / 1000),
        date: dateStr,
        daysToExpiry: Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      };
    }),
    strikes: Array.from(strikes).sort((a, b) => a - b),
    options: nearestExpiration ? expirationMap.get(nearestExpiration) : { calls: [], puts: [] }
  };
}

/**
 * GET - Fetch options chain for a symbol
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const date = searchParams.get('date'); // Optional expiration date

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching options chain for ${symbol} using Alpaca API...`);

    // Get Alpaca API credentials
    const apiKey = process.env.NEXT_PUBLIC_ALPACA_API_KEY || process.env.ALPACA_API_KEY_ID;
    const apiSecret = process.env.NEXT_PUBLIC_ALPACA_API_SECRET || process.env.ALPACA_SECRET_KEY;

    if (!apiKey || !apiSecret) {
      throw new Error('Alpaca API credentials not configured');
    }

    // First, get the current stock price from Alpaca
    console.log(`Getting current price for ${symbol}...`);
    const quoteResponse = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!quoteResponse.ok) {
      throw new Error(`Failed to get stock quote: ${quoteResponse.status} ${quoteResponse.statusText}`);
    }

    const quoteData = await quoteResponse.json();
    const underlyingPrice = quoteData.quote?.ap || quoteData.quote?.bp || 0;

    console.log(`Got underlying price for ${symbol}: $${underlyingPrice}`);

    if (underlyingPrice === 0) {
      throw new Error(`Could not get current price for ${symbol}`);
    }

    // Get options chain from Alpaca
    console.log(`Fetching options chain for ${symbol}...`);
    const optionsUrl = `https://paper-api.alpaca.markets/v2/options/contracts?underlying_symbols=${symbol}&limit=1000`;

    const optionsResponse = await fetch(optionsUrl, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!optionsResponse.ok) {
      const errorText = await optionsResponse.text();
      console.error(`Alpaca options API error: ${optionsResponse.status} - ${errorText}`);
      throw new Error(`Alpaca options API error: ${optionsResponse.status} ${optionsResponse.statusText}`);
    }

    const optionsData = await optionsResponse.json();
    
    console.log(`Got ${optionsData.option_contracts?.length || 0} options contracts from Alpaca`);
    
    if (!optionsData.option_contracts || optionsData.option_contracts.length === 0) {
      throw new Error(`No options data available for ${symbol}`);
    }

    // Get options quotes for live bid/ask data
    const contractSymbols = optionsData.option_contracts.slice(0, 50).map((contract: any) => contract.symbol);
    console.log(`Getting quote data for ${contractSymbols.length} contracts...`);

    let quotesData = { quotes: {} };
    let barsData = { bars: {} };
    
    // Try to get latest quotes first (for bid/ask)
    try {
      const quotesUrl = `https://data.alpaca.markets/v1beta1/options/quotes/latest?symbols=${contractSymbols.join(',')}`;
      const quotesResponse = await fetch(quotesUrl, {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });

      if (quotesResponse.ok) {
        quotesData = await quotesResponse.json();
        console.log(`Got live quotes for options`);
      } else {
        console.warn(`Failed to get options quotes: ${quotesResponse.status}`);
      }
    } catch (error) {
      console.warn(`Error fetching options quotes:`, error);
    }

    // Also get bars for volume and last price
    try {
      const barsUrl = `https://data.alpaca.markets/v1beta1/options/bars?symbols=${contractSymbols.join(',')}&timeframe=1Day&limit=1`;
      const barsResponse = await fetch(barsUrl, {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });

      if (barsResponse.ok) {
        barsData = await barsResponse.json();
        console.log(`Got pricing data for options`);
      } else {
        console.warn(`Failed to get options pricing data: ${barsResponse.status}`);
      }
    } catch (error) {
      console.warn(`Error fetching options pricing:`, error);
    }

    // Process the options data
    const processedData = processAlpacaOptionsData(
      optionsData.option_contracts,
      barsData.bars || {},
      quotesData.quotes || {},
      underlyingPrice,
      symbol
    );
    
    console.log(`Successfully processed options chain for ${symbol}`);

    return NextResponse.json(processedData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate'
      },
    });

  } catch (error) {
    console.error('Error fetching options chain:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch options data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}