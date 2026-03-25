const { Pool } = require('pg'); 
require('dotenv').config(); 
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
}); 
async function run() { 
  try { 
    // Target valid companies in Org 11
    const validCompanyIds = [16, 17, 18, 19, 20];
    
    // Get all deals for Org 11
    const deals = await pool.query("SELECT id FROM deals WHERE organization_id = 11");
    console.log(`Found ${deals.rows.length} deals in Organisation 11.`);

    for (let i = 0; i < deals.rows.length; i++) {
        const dealId = deals.rows[i].id;
        // Distribute deals across the 5 companies
        const companyId = validCompanyIds[i % validCompanyIds.length];
        
        await pool.query("UPDATE deals SET company_id = $1 WHERE id = $2", [companyId, dealId]);
    }

    console.log("Successfully re-linked all deals in Organisation 11 to valid companies.");

  } catch(e) { 
    console.error(e); 
  } finally { 
    await pool.end(); 
  } 
} 
run();
