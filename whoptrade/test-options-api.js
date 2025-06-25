const https = require('https');

// Test the options API endpoint
const testOptionsAPI = async () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/market-data/options?symbol=AAPL',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Response Status:', res.statusCode);
          console.log('Response Headers:', res.headers);
          console.log('Response Body:', JSON.stringify(response, null, 2));
          
          // Check if strike prices are numbers
          if (response.options && response.options.calls) {
            const firstCall = response.options.calls[0];
            if (firstCall) {
              console.log('\nFirst call contract:');
              console.log('Strike type:', typeof firstCall.strike);
              console.log('Strike value:', firstCall.strike);
              console.log('Last price type:', typeof firstCall.lastPrice);
              console.log('Last price value:', firstCall.lastPrice);
            }
          }
          
          resolve(response);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.end();
  });
};

// Run the test
testOptionsAPI()
  .then(() => {
    console.log('\nTest completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });