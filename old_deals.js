const { Pool } = require('pg'); 
require('dotenv').config(); 
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
}); 
async function run() { 
  const res = await pool.query("SELECT name, stage, created_at FROM deals WHERE stage NOT IN ('Closed Won', 'Closed Lost') ORDER BY created_at ASC LIMIT 1"); 
  const row = res.rows[0];
  console.log('OLDEST DEAL NAME:', row.name);
  console.log('CREATED AT:', row.created_at);
  console.log('STAGE:', row.stage);
  await pool.end();
} 
run();
