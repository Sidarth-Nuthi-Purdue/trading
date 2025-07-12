// Deploy the create_whop_user RPC function to Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://mvlncehwfqhvpmfzvntc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12bG5jZWh3ZnFodnBtZnp2bnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ2NDEzNCwiZXhwIjoyMDY2MDQwMTM0fQ.zRDy2hhcQkkbX4mp-Qa6ppLmkiC-x9BH9R_-RfefCY0'
);

const sql = fs.readFileSync('./create_whop_user_rpc.sql', 'utf8');

async function deployRPC() {
  try {
    console.log('Deploying create_whop_user RPC function...');
    
    const { data, error } = await supabase.rpc('', {}, {
      count: 'exact',
      head: false,
      rawSQL: sql
    });

    if (error) {
      console.error('Error deploying RPC:', error);
      return;
    }

    console.log('RPC function deployed successfully!');
    console.log('Testing function...');
    
    // Test the function with a sample call
    const testResult = await supabase.rpc('create_whop_user', {
      p_user_id: '00000000-0000-0000-0000-000000000001',
      p_whop_user_id: 'test_user',
      p_email: 'test@example.com',
      p_username: 'testuser'
    });
    
    if (testResult.error) {
      console.error('Test failed:', testResult.error);
    } else {
      console.log('Test successful! Created user ID:', testResult.data);
    }
    
  } catch (error) {
    console.error('Deployment error:', error);
  }
}

deployRPC();