// Test script to debug Alpaca options API
const fetch = require('node-fetch');

async function testAlpacaOptions() {
  const apiKey = 'PKYCK71DJORXHZU80WB0';
  const apiSecret = 'jRc2urANJhLpfqbYYnk6zo86sO1rmHMRpkyKBxCP';
  const symbol = 'AAPL';
  
  const urls = [
    `https://paper-api.alpaca.markets/v2/options/contracts?underlying_symbols=${symbol}&limit=100`,
    `https://data.alpaca.markets/v1beta1/options/contracts?underlying_symbols=${symbol}&limit=100`,
    `https://data.alpaca.markets/v1beta1/options/contracts?underlying_symbols=${symbol}&limit=100&status=active`,
    `https://data.alpaca.markets/v1beta1/options/contracts?underlying_symbols=${symbol}&limit=100&status=active&expiration_date.gte=${new Date().toISOString().split('T')[0]}`
  ];
  
  for (const url of urls) {
    console.log(`\n=== Testing URL: ${url} ===`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Contract count: ${data.option_contracts?.length || 0}`);
        
        if (data.option_contracts && data.option_contracts.length > 0) {
          // Get unique expiration dates
          const expirations = [...new Set(data.option_contracts.map(c => c.expiration_date))];
          console.log(`Unique expiration dates: ${expirations.length}`);
          console.log(`First 10 expirations:`, expirations.slice(0, 10));
          
          // Calculate days to expiry for each
          const now = new Date();
          const daysToExpiry = expirations.map(exp => {
            const expDate = new Date(exp);
            const days = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return { date: exp, days };
          }).sort((a, b) => a.days - b.days);
          
          console.log(`Days to expiry range: ${daysToExpiry[0]?.days} to ${daysToExpiry[daysToExpiry.length - 1]?.days}`);
        }
      } else {
        const errorText = await response.text();
        console.log(`Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
}

testAlpacaOptions();