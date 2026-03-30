
import { query } from "../lib/db";

const INDIAN_NAMES = [
  { first: "Aarav", last: "Sharma" }, { first: "Ishani", last: "Verma" },
  { first: "Siddharth", last: "Gupta" }, { first: "Meera", last: "Nair" },
  { first: "Amit", last: "Patel" }, { first: "Priya", last: "Reddy" },
  { first: "Vikram", last: "Singh" }, { first: "Ananya", last: "Deshmukh" },
  { first: "Rohan", last: "Mehta" }, { first: "Sana", last: "Iyer" },
  { first: "Arjun", last: "Kapoor" }, { first: "Kavya", last: "Joshi" },
  { first: "Rahul", last: "Malhotra" }, { first: "Diya", last: "Chopra" },
  { first: "Nikhil", last: "Aggarwal" }
];

const JOB_TITLES = [
  "CEO", "Marketing Head", "Analytics Director", "Sales Lead", "Operations Head",
  "CTO", "VP Engineering", "HR Head", "Legal Counsel", "Architect",
  "Associate", "Research Analyst", "Strategy Lead", "Digital Transformation", "Success Manager"
];

const COMPANIES = ["Reliance Digital", "Zomato Tech", "Tata Consultancy"];

async function reboot() {
  const orgId = 11;
  console.log("--- STARTING CRITICAL REBOOT ---");

  // 1. WIPE EVERYTHING (TOTAL HYGIENE)
  await query("DELETE FROM tasks");
  await query("UPDATE deals SET champion_id = NULL");
  await query("DELETE FROM deals");
  await query("UPDATE contacts SET company_id = NULL");
  await query("DELETE FROM contacts");
  await query("DELETE FROM companies");
  console.log("Database wiped permanently.");

  // 2. COMPANIES
  let companyIds: number[] = [];
  for (const name of COMPANIES) {
    const res = await query(`INSERT INTO companies (name, domain, city, organization_id) VALUES ($1, $2, $3, $4) RETURNING id`, 
      [name, `${name.toLowerCase().replace(/ /g, '')}.com`, "Mumbai", orgId]);
    companyIds.push(res.rows[0].id);
  }

  // 3. CONTACTS (15)
  let contactIds: number[] = [];
  for (let i = 0; i < 15; i++) {
    const cid = companyIds[Math.floor(i / 5)];
    const n = INDIAN_NAMES[i];
    const res = await query(`INSERT INTO contacts (first_name, last_name, email, job_title, company_id, organization_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [n.first, n.last, `${n.first.toLowerCase()}@${COMPANIES[Math.floor(i / 5)].toLowerCase().replace(/ /g, '')}.com`, JOB_TITLES[i], cid, orgId]);
    contactIds.push(res.rows[0].id);
  }
  console.log(`15 Indian contacts created with IDs: ${contactIds.join(', ')}`);

  const REAL_DEAL_TITLES = [
    "Enterprise ERP Migration", "Zomato Logistics SaaS", "Reliance Retail POS Upgrade", 
    "Tata Steel Supply Chain Analytics", "HDFC Digital Wealth Portal", "Smart City Smart Metering", 
    "Global Fleet Telematics", "AI-Driven Inventory Forecast", "Warehouse Automation Phase 1", 
    "Core Banking Modernization", "Cloud Security Transformation", "Data Lake Implementation", 
    "Retail Customer Loyalty SaaS", "E-commerce Last-Mile Integration", "Blockchain Trade Finance", 
    "Next-Gen Payment Gateway", "Industrial IoT Monitoring", "Precision Farming Platform", 
    "Pharma Compliance Software", "Auto Manufacturing Ops ERP", "Digital Health Records Suite", 
    "Renewable Grid Optimization", "Airlines Revenue Management", "Consumer Goods CRM Suite", 
    "Real Estate Portfolio SaaS", "Global HR Shared Services", "Cyber Incident Response Ops", 
    "ESG Compliance Dashboard", "Strategic Sourcing Platform", "Omnichannel Retail Support"
  ];

  const REAL_TASK_TITLES = [
      "Executive Discovery Session", "Technical Architecture Review", "Value Proposition Workshop",
      "Draft Proposal Review", "Budgetary Approval Sync", "DSO and Terms Negotiation", "Final Legal Compliance Audit",
      "Security Assessment Questionnaire", "Stakeholder Alignment Call", "Project Scope Definition"
  ];

  // 4. HISTORICAL DEALS (10 WON, 10 LOST) FOR AI TRAINING
  console.log("Seeding AI Training Signals (20 Historical Professional Deals)...");
  for (let i = 0; i < 20; i++) {
    const isWon = i < 10;
    const cid = companyIds[i % 3];
    const stage = isWon ? "Closed Won" : "Closed Lost";
    const date = "2025-12-15";
    const dname = `Historical: ${REAL_DEAL_TITLES[i % 20]}`;
    const dres = await query(`INSERT INTO deals (name, amount, stage, company_id, organization_id, demo_completed, champion_identified, created_at, close_date, is_synthetic) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [dname, 250000 + (i*5000), stage, cid, orgId, isWon, isWon, date, date, true]);
    
    if (isWon) {
       for (let j=0; j<8; j++) {
           await query(`INSERT INTO tasks (title, status, deal_id, organization_id) VALUES ($1, $2, $3, $4)`, 
           [REAL_TASK_TITLES[j % REAL_TASK_TITLES.length], "Completed", dres.rows[0].id, orgId]);
       }
    }
  }

  // 5. THE 30 DEALS WITH EXTREME VARIETY (10 Low, 10 Med, 10 High)
  console.log("Generating 30 Deals with Extreme Variety (For High/Med/Low spread)...");
  for (let i = 0; i < 30; i++) {
    const cid = companyIds[i % 3];
    const contactId = contactIds[Math.floor(i % 15)];
    const dealTitle = REAL_DEAL_TITLES[i];
    
    let stage = ""; let demo = false; let champ = false; let notes = 0;
    
    if (i < 10) { // THE "WINNERS" (Target: 85% - 98%)
      stage = (i % 2 === 0) ? "Contract Sent" : "Closed Won";
      demo = true; champ = true; notes = 40; // MASSIVE activity for high score
    } else if (i < 20) { // THE "BUILDERS" (Target: 45% - 65%)
      stage = (i % 2 === 0) ? "Presentation Scheduled" : "Decision Maker Bought-In";
      demo = true; champ = Math.random() > 0.5; notes = 15;
    } else { // THE "STALLEDS" (Target: 5% - 25%)
      stage = (i % 2 === 0) ? "Appointment Scheduled" : "Closed Lost";
      demo = false; champ = false; notes = 1; // LOW activity for low score
    }

    const created = "2026-01-15";
    const closed = new Date(2026, 2, 31).toISOString();

    const dres = await query(`INSERT INTO deals (name, amount, stage, company_id, organization_id, demo_completed, champion_identified, champion_id, created_at, close_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [dealTitle, 400000 + (i*15000), stage, cid, orgId, demo, champ, (champ || i < 10) ? contactId : null, created, (stage.includes("Closed") ? created : closed)]);
    
    for (let j=0; j<notes; j++) {
        await query(`INSERT INTO tasks (title, status, deal_id, organization_id, created_at) VALUES ($1, $2, $3, $4, $5)`, 
        [REAL_TASK_TITLES[j % REAL_TASK_TITLES.length], "Completed", dres.rows[0].id, orgId, created]);
    }
  }

  console.log("--- REBOOT COMPLETE ---");
}

reboot().catch(console.error);
