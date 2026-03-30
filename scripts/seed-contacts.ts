
import { query } from "../lib/db";

const FIRST_NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];
const JOB_TITLES = ["CTO", "Head of Sales", "Product Manager", "Sales Director", "Operations Head", "HR Manager", "Legal Counsel", "Marketing VP", "Account Executive", "VP Engineering"];

async function seedContacts() {
  console.log("--- Starting Contact Seeding ---");

  // 1. Link orphan contacts to random existing companies
  const companyRes = await query("SELECT id FROM companies");
  const companyIds = companyRes.rows.map(r => r.id);

  if (companyIds.length === 0) {
    console.error("No companies found to link contacts to!");
    return;
  }

  const orphans = await query("SELECT id FROM contacts WHERE company_id IS NULL");
  console.log(`Linking ${orphans.rows.length} orphan contacts...`);
  for (const orphan of orphans.rows) {
    const randomCompanyId = companyIds[Math.floor(Math.random() * companyIds.length)];
    await query("UPDATE contacts SET company_id = $1 WHERE id = $2", [randomCompanyId, orphan.id]);
  }

  // 2. Add 5 fresh contacts per company
  console.log(`Adding 5 fresh contacts per company for ${companyIds.length} companies...`);
  
  // Get orgId from a company (assuming they all share it usually)
  const orgRes = await query("SELECT organization_id FROM companies LIMIT 1");
  const orgId = orgRes.rows[0]?.organization_id || 1;

  for (const cid of companyIds) {
    // Check if company already has enough contacts
    const countRes = await query("SELECT COUNT(*) FROM contacts WHERE company_id = $1", [cid]);
    const currentCount = parseInt(countRes.rows[0].count);

    if (currentCount < 5) {
      const needed = 5 - currentCount;
      console.log(`Company ${cid} needs ${needed} more contacts.`);
      
      for (let i = 0; i < needed; i++) {
        const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const job = JOB_TITLES[Math.floor(Math.random() * JOB_TITLES.length)];
        const email = `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(Math.random()*100)}@company.com`;
        
        await query(`
          INSERT INTO contacts (first_name, last_name, email, job_title, lifecycle_stage, company_id, organization_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [first, last, email, job, 'Subscriber', cid, orgId]);
      }
    }
  }

  console.log("--- Contact Seeding Complete ---");
}

seedContacts().catch(console.error);
