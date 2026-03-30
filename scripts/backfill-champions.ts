
import { query } from "../lib/db";

async function backfillChampions() {
  console.log("--- Starting Champion Backfill ---");

  // Finding deals that are identified as having a champion but are currently unlinked
  const dealsRes = await query(`
    SELECT id, company_id 
    FROM deals 
    WHERE champion_identified = TRUE AND champion_id IS NULL AND company_id IS NOT NULL
  `);

  console.log(`Found ${dealsRes.rows.length} unlinked champions.`);

  for (const deal of dealsRes.rows) {
    // Find the first contact belonging to the same company
    const contactRes = await query(`
      SELECT id 
      FROM contacts 
      WHERE company_id = $1 
      LIMIT 1
    `, [deal.company_id]);

    if (contactRes.rows.length > 0) {
      const contactId = contactRes.rows[0].id;
      await query(`
        UPDATE deals 
        SET champion_id = $1 
        WHERE id = $2
      `, [contactId, deal.id]);
      console.log(`Linked Deal ${deal.id} to Contact ${contactId}`);
    } else {
      console.log(`No contact found for Company ${deal.company_id} (Deal ${deal.id})`);
    }
  }

  console.log("--- Backfill Complete ---");
}

backfillChampions().catch(console.error);
