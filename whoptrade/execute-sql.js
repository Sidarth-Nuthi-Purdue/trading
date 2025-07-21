require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  // Read the SQL file
  const sqlFilePath = path.resolve(__dirname, './competitions-schema.sql');
  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  
  // Create a PostgreSQL client
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to the database');
    
    // Execute the SQL
    console.log('Executing SQL...');
    await client.query(sql);
    console.log('SQL executed successfully');
  } catch (error) {
    console.error('Error executing SQL:', error);
  } finally {
    // Close the connection
    await client.end();
    console.log('Database connection closed');
  }
}

main().catch(console.error); 