const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applySchema() {
  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Please check your .env.local file.');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'virtual-trading-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Applying virtual trading schema...');
    
    // Execute the SQL schema
    const { error } = await supabase.rpc('exec_sql', { sql: schema });
    
    if (error) {
      console.error('Error applying schema:', error.message);
      process.exit(1);
    }
    
    console.log('Schema applied successfully!');
    
    // Verify the tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .in('tablename', [
        'virtual_trading_accounts', 
        'virtual_positions', 
        'virtual_orders', 
        'virtual_transactions'
      ]);
    
    if (tablesError) {
      console.error('Error verifying tables:', tablesError.message);
    } else {
      console.log('Created tables:');
      tables.forEach(table => console.log(`- ${table.tablename}`));
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

applySchema(); 