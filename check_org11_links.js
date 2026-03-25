const { Pool } = require('pg'); 
require('dotenv').config(); 
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
}); 
async function run() { 
  try { 
    console.log("--- ORGANIZATION 11 DEALS ---");
    const deals = await pool.query("SELECT id, name, company_id, organization_id FROM deals WHERE organization_id = 11 LIMIT 20");
    console.log(JSON.stringify(deals.rows, null, 2));

    console.log("\n--- ORGANIZATION 11 COMPANIES ---");
    const companies = await pool.query("SELECT id, name, organization_id FROM companies WHERE organization_id = 11");
    console.log(JSON.stringify(companies.rows, null, 2));

    console.log("\n--- ANY OTHER COMPANIES (Top 20) ---");
    const otherCompanies = await pool.query("SELECT id, name, organization_id FROM companies LIMIT 20");
    console.log(JSON.stringify(otherCompanies.rows, null, 2));

  } catch(e) { 
    console.error(e); 
  } finally { 
    await pool.end(); 
  } 
} 
run();
