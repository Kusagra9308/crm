import { query } from '../lib/db';
import 'dotenv/config';

async function test() {
  const result = await query(`
    SELECT deals.*, companies.name as company_name 
    FROM deals 
    LEFT JOIN companies ON deals.company_id = companies.id 
    LIMIT 2
  `);
  console.log("DEAL 0 (WITH AI SCORE?):", result.rows[0]);
}

test();
