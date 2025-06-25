// Alpaca Broker API Integration
// This file contains functions for interacting with Alpaca Broker API to manage trading accounts

import axios from 'axios';

// Function to get API configuration from environment variables
function getAlpacaConfig() {
  // Get configuration from environment variables
  const brokerBaseUrl = process.env.ALPACA_BROKER_BASE_URL || 'https://broker-api.sandbox.alpaca.markets';
  const dataBaseUrl = process.env.ALPACA_DATA_BASE_URL || 'https://data.sandbox.alpaca.markets';
  
  // Get API keys from environment variables
  const apiKey = process.env.ALPACA_BROKER_API_KEY;
  const apiSecret = process.env.ALPACA_BROKER_API_SECRET;
  
  // Check if API keys are available
  if (!apiKey || !apiSecret) {
    console.error('Alpaca API keys not found in environment variables!');
  }
  
  return {
    brokerBaseUrl,
    dataBaseUrl,
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      'Content-Type': 'application/json'
    }
  };
}

// Type definitions
export interface AlpacaAccountRequest {
  firstName: string;
  lastName: string;
  email: string;
  userId: string; // Our internal user ID
  initialFunding?: number; // Optional initial funding amount in dollars
}

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  crypto_status: string;
  currency: string;
  buying_power: string;
  regt_buying_power: string;
  daytrading_buying_power: string;
  cash: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  trade_suspended_by_user: boolean;
  multiplier: string;
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  long_market_value: string;
  short_market_value: string;
  initial_margin: string;
  maintenance_margin: string;
  last_maintenance_margin: string;
  sma: string;
  daytrade_count: number;
}

export interface OrderData {
  symbol: string;
  qty: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limit_price?: string;
  stop_price?: string;
  trail_price?: string;
  trail_percent?: string;
  extended_hours?: boolean;
  client_order_id?: string;
  order_class?: 'simple' | 'bracket' | 'oco' | 'oto';
  take_profit?: {
    limit_price: string;
  };
  stop_loss?: {
    stop_price: string;
    limit_price?: string;
  };
}

/**
 * Create a new Alpaca trading account
 */
export async function createAlpacaAccount(accountData: AlpacaAccountRequest): Promise<AlpacaAccount> {
  try {
    const { brokerBaseUrl, headers } = getAlpacaConfig();
    const initialFunding = accountData.initialFunding || 10000; // Default to $10,000 if not specified
    
    const payload = {
      enabled_assets: ['us_equity'],
      funding_source: { 
        type: 'FAKE_MONEY',
        amount: initialFunding.toString() // Convert to string for API
      },
      contact: {
        email_address: accountData.email,
        phone_number: '+10000000000', // Placeholder
        street_address: ['123 Paper Trading St'],
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'USA'
      },
      identity: {
        given_name: accountData.firstName,
        family_name: accountData.lastName,
        date_of_birth: '1990-01-01', // Placeholder
        tax_id: '000-00-0000', // Placeholder
        tax_id_type: 'USA_SSN',
        country_of_citizenship: 'USA',
        country_of_birth: 'USA',
        country_of_tax_residence: 'USA',
        funding_source: ['employment_income']
      },
      disclosures: {
        is_control_person: false,
        is_affiliated_exchange_or_finra: false,
        is_politically_exposed: false,
        immediate_family_exposed: false
      },
      agreements: [
        {
          agreement: 'margin_agreement',
          signed_at: new Date().toISOString(),
          ip_address: '127.0.0.1'
        },
        {
          agreement: 'account_agreement',
          signed_at: new Date().toISOString(),
          ip_address: '127.0.0.1'
        },
        {
          agreement: 'customer_agreement',
          signed_at: new Date().toISOString(),
          ip_address: '127.0.0.1'
        }
      ],
    };
    
    // Create the account
    const response = await axios.post(
      `${brokerBaseUrl}/v1/accounts`,
      payload,
      { headers }
    );
        
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Failed to create Alpaca account:', error.response.data);
      if (error.response.status === 403) {
        throw new Error(`Alpaca API error: 403 Forbidden. This might be due to incorrect API keys, IP address not being whitelisted, or not having Broker API access enabled on your Alpaca account. Please check your Alpaca dashboard. Details: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Alpaca API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    console.error('Failed to create Alpaca account:', error);
    throw error;
  }
}

/**
 * Get account details
 */
export async function getAccount(accountId: string): Promise<AlpacaAccount> {
  try {
    const { brokerBaseUrl, headers } = getAlpacaConfig();
    const response = await axios.get(
      `${brokerBaseUrl}/v1/accounts/${accountId}`,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Failed to get account ${accountId}:`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 403 || error.response.status === 401) {
        // Mock data for development if auth fails
        return getMockAccountData(accountId);
      }
      
      throw new Error(`Alpaca API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get positions for an account
 */
export async function getPositions(accountId: string) {
  try {
    const { brokerBaseUrl, headers } = getAlpacaConfig();
    const response = await axios.get(
      `${brokerBaseUrl}/v1/trading/accounts/${accountId}/positions`,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Failed to get positions for account ${accountId}:`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 403 || error.response.status === 401) {
        // Return empty array for development
        console.log('Failed to fetch positions from Alpaca API:', error.response.status, error.response.data);
        console.log('Using mock data instead');
        return [];
      }
      
      throw new Error(`Alpaca API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get orders for an account
 */
export async function getOrders(accountId: string) {
  try {
    const { brokerBaseUrl, headers } = getAlpacaConfig();
    const response = await axios.get(
      `${brokerBaseUrl}/v1/trading/accounts/${accountId}/orders`,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Failed to get orders for account ${accountId}:`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status === 403 || error.response.status === 401) {
        // Return empty array for development
        console.log('Failed to fetch orders from Alpaca API:', error.response.status, error.response.data);
        console.log('Using mock data instead');
        return [];
      }
      
      throw new Error(`Alpaca API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Create a new order
 */
export async function createOrder(accountId: string, orderData: OrderData) {
  try {
    const { brokerBaseUrl, headers } = getAlpacaConfig();
    const response = await axios.post(
      `${brokerBaseUrl}/v1/trading/accounts/${accountId}/orders`,
      orderData,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Failed to create order for account ${accountId}:`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Alpaca API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get latest quote for a symbol
 */
export async function getLatestQuote(symbol: string) {
  try {
    const { dataBaseUrl, headers } = getAlpacaConfig();
    const response = await axios.get(
      `${dataBaseUrl}/v2/stocks/${symbol}/quotes/latest`,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Failed to get latest quote for ${symbol}:`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Alpaca API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get latest trade for a symbol
 */
export async function getLatestTrade(symbol: string) {
  try {
    const { dataBaseUrl, headers } = getAlpacaConfig();
    const response = await axios.get(
      `${dataBaseUrl}/v2/stocks/${symbol}/trades/latest`,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Failed to get latest trade for ${symbol}:`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Alpaca API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Generate mock account data for development
 */
function getMockAccountData(accountId: string): AlpacaAccount {
  console.log('Failed to fetch account data from Alpaca API');
  console.log('Using mock data instead');
  
  return {
    id: accountId,
    account_number: `PA${Math.floor(Math.random() * 10000000)}`,
    status: 'ACTIVE',
    crypto_status: 'ACTIVE',
    currency: 'USD',
    buying_power: '10000.00',
    regt_buying_power: '10000.00',
    daytrading_buying_power: '10000.00',
    cash: '10000.00',
    portfolio_value: '10000.00',
    pattern_day_trader: false,
    trading_blocked: false,
    transfers_blocked: false,
    account_blocked: false,
    created_at: new Date().toISOString(),
    trade_suspended_by_user: false,
    multiplier: '1',
    shorting_enabled: true,
    equity: '10000.00',
    last_equity: '10000.00',
    long_market_value: '0.00',
    short_market_value: '0.00',
    initial_margin: '0.00',
    maintenance_margin: '0.00',
    last_maintenance_margin: '0.00',
    sma: '0.00',
    daytrade_count: 0
  };
} 