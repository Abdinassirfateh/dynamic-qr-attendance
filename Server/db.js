const { Pool } = require('pg');
require('dotenv').config();

// Create a new connection pool using the connection string from your .env file
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // If you are using Supabase or Neon, SSL is usually required. 
    // This setting ensures the connection is secure.
    ssl: {
        rejectUnauthorized: false
    }
});

// Test the connection when it first connects
pool.on('connect', () => {
    console.log('Successfully connected to the PostgreSQL database!');
});

// Log any unexpected errors so the server doesn't silently fail
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Export the pool so we can use it in index.js and other files to run queries
module.exports = pool;