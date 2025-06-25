// Verify Alpaca API Keys Script
// Run with: node verify-alpaca-keys.js

const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

async function verifyAlpacaKeys() {
  console.log('Verifying Alpaca Broker API keys...');
  
  // Get API keys from environment variables
  const apiKey = process.env.ALPACA_BROKER_API_KEY;
  const apiSecret = process.env.ALPACA_BROKER_API_SECRET;
  const brokerBaseUrl = process.env.ALPACA_BROKER_BASE_URL || 'https://broker-api.sandbox.alpaca.markets';
  
  if (!apiKey || !apiSecret) {
    console.error('❌ ERROR: Alpaca API keys not found in .env.local file!');
    console.log('Please make sure you have ALPACA_BROKER_API_KEY and ALPACA_BROKER_API_SECRET set in your .env.local file.');
    return;
  }
  
  console.log(`API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`API Secret: ${apiSecret.substring(0, 4)}...${apiSecret.substring(apiSecret.length - 4)}`);
  console.log(`Base URL: ${brokerBaseUrl}`);
  
  try {
    // Make a simple request to verify the keys
    const response = await axios.get(`${brokerBaseUrl}/v1/accounts`, {
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret
      }
    });
    
    console.log('✅ SUCCESS: API keys are working correctly!');
    console.log(`Found ${response.data.length} accounts in your Alpaca Broker account.`);
    
    if (response.data.length > 0) {
      console.log('\nSample account:');
      const sampleAccount = response.data[0];
      console.log(`- Account ID: ${sampleAccount.id}`);
      console.log(`- Account Number: ${sampleAccount.account_number}`);
      console.log(`- Status: ${sampleAccount.status}`);
    }
    
  } catch (error) {
    console.error('❌ ERROR: API keys verification failed!');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error details: ${JSON.stringify(error.response.data)}`);
      
      if (error.response.status === 403) {
        console.log('\nPossible reasons for this error:');
        console.log('1. Your API keys are incorrect');
        console.log('2. Your IP address is not whitelisted (if you have IP restrictions enabled)');
        console.log('3. Your Alpaca account does not have Broker API access enabled');
      }
    } else {
      console.error(`Error: ${error.message}`);
    }
  }
}

verifyAlpacaKeys(); 