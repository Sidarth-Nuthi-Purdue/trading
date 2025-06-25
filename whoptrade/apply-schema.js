// Node.js script to apply the complete SQL setup

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applySchema() {
  // Create Supabase client with admin privileges
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Please check your .env.local file.');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  try {
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'complete-setup.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Applying database schema...');
    
    // Split the SQL into statements to execute them separately
    const statements = schema
      .replace(/\/\*.*?\*\//gs, '') // Remove /* */ comments
      .replace(/--.*$/gm, '') // Remove -- comments
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.warn(`Warning: Error executing statement ${i + 1}: ${error.message}`);
          console.warn(`Statement: ${statement.substring(0, 100)}...`);
        }
      } catch (err) {
        console.warn(`Warning: Exception executing statement ${i + 1}: ${err.message}`);
        console.warn(`Statement: ${statement.substring(0, 100)}...`);
        // Continue with next statement
      }
    }
    
    console.log('Schema application completed!');
    
    // Verify tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'virtual_trading_accounts',
        'virtual_positions',
        'virtual_orders',
        'virtual_transactions',
        'users'
      ]);
    
    if (tablesError) {
      console.error('Error verifying tables:', tablesError.message);
    } else {
      console.log('Created tables:');
      if (tables && tables.length > 0) {
        tables.forEach(table => console.log(`- ${table.table_name}`));
      } else {
        console.log('No matching tables found. There might be an issue with permissions.');
      }
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

applySchema(); 