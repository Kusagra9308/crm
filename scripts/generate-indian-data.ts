
import { query } from "../lib/db";

const INDIAN_NAMES = [
  { first: "Aarav", last: "Sharma" },
  { first: "Ishani", last: "Verma" },
  { first: "Siddharth", last: "Gupta" },
  { first: "Meera", last: "Nair" },
  { first: "Amit", last: "Patel" },
  { first: "Priya", last: "Reddy" },
  { first: "Vikram", last: "Singh" },
  { first: "Ananya", last: "Deshmukh" },
  { first: "Rohan", last: "Mehta" },
  { first: "Sana", last: "Iyer" },
  { first: "Arjun", last: "Kapoor" },
  { first: "Kavya", last: "Joshi" },
  { first: "Rahul", last: "Malhotra" },
  { first: "Diya", last: "Chopra" },
  { first: "Nikhil", last: "Aggarwal" }
];

const JOB_TITLES = [
  "Chief Executive Officer",
  "Product Marketing Manager",
  "Head of Analytics",
  "Sales Director",
  "Lead Operations Engineer",
  "Chief Technical Officer",
  "VP of Engineering",
  "Human Resources Business Partner",
  "Legal Counsel",
  "Solutions Architect",
  "Executive Associate",
  "Senior Research Analyst",
  "Content Strategy Lead",
  "Digital Transformation Lead",
  "Client Success Manager"
];

const COMPANIES = [
  "Reliance Digital",
  "Zomato Tech",
  "Tata Consultancy Services"
];

const STAGES = [
  "Appointment Scheduled",
  "Qualified to Buy",
  "Presentation Scheduled",
  "Decision Maker Bought-In",
  "Contract Sent",
  "Closed Won",
  "Closed Lost"
];

async function generateData() {
  const orgId = 11;
  console.log("--- Starting Indian Data Generation (Org 11) ---");

  // 1. Create 3 Companies
  let companyIds: number[] = [];
  for (const name of COMPANIES) {
    const res = await query(`INSERT INTO companies (name, domain, city, organization_id) VALUES ($1, $2, $3, $4) RETURNING id`, 
      [name, `${name.toLowerCase().replace(/ /g, '')}.com`, "Mumbai", orgId]);
    companyIds.push(res.rows[0].id);
  }
  console.log(`Created ${companyIds.length} companies.`);

  // 2. Create 15 Contacts (5 per company)
  let contactIds: number[] = [];
  for (let i = 0; i < 15; i++) {
    const companyId = companyIds[Math.floor(i / 5)];
    const name = INDIAN_NAMES[i];
    const job = JOB_TITLES[i];
    const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}@${COMPANIES[Math.floor(i / 5)].toLowerCase().replace(/ /g, '')}.com`;
    
    const res = await query(`
      INSERT INTO contacts (first_name, last_name, email, job_title, lifecycle_stage, company_id, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [name.first, name.last, email, job, 'Subscriber', companyId, orgId]);
    contactIds.push(res.rows[0].id);
  }
  console.log(`Created ${contactIds.length} Indian contacts (5 per company).`);

  console.log("Generating 12 historical (closed) deals for AI training...");
  for (let i = 0; i < 12; i++) {
    const isWon = i < 6;
    const companyId = companyIds[i % 3];
    const name = `Historical Deal ${isWon ? 'Won' : 'Lost'} ${i+1}`;
    const amount = 85000 + (i * 10000);
    const demo = isWon; // Winners always do demos
    const champ = isWon;
    const stage = isWon ? "Closed Won" : "Closed Lost";
    const date = new Date(2025, 11, 10 + i).toISOString(); // Dec 2025
    
    const dRes = await query(`
      INSERT INTO deals (name, amount, stage, created_at, close_date, company_id, organization_id, demo_completed, champion_identified, is_synthetic)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [name, amount, stage, date, date, companyId, orgId, demo, champ, true]);
    
    const dealId = dRes.rows[0].id;
    // Activity: Winners have many notes, Losers have 0
    const notes = isWon ? 12 : 0;
    for (let j = 0; j < notes; j++) {
       await query(`INSERT INTO tasks (title, status, deal_id, organization_id, created_at) VALUES ($1, $2, $3, $4, $5)`, 
         ["High Signal Activity", "Completed", dealId, orgId, date]);
    }
  }

  // 3. Create 30 Deals with Specific AI Score Distribution
  console.log("Generating 30 deals with exact score distribution targets...");
  
  const dealNames = [
    "Enterprise Analytics Suite", "Cloud Migration Phase 2", "Fleet Ops Integration",
    "Digital Payments Gateway", "Supply Chain Optimization", "Market Expansion Software",
    "Core Banking Upgrade", "E-commerce Front-end Refresh", "Security Compliance Audit",
    "Customer Insight Dashboard", "Warehouse Management SaaS", "Omnichannel Engagement",
    "HR Portaling Platform", "Finance Automation Engine", "Logistics Visibility Tool",
    "Smart Grid Deployment", "Retail Inventory Monitoring", "Media Content Pipeline",
    "AI-Based Demand Forecasting", "Network Infrastructure Overhaul", "Data Warehouse Expansion",
    "B2B Portal Development", "Legacy System Modernization", "Field Sales Automation",
    "Procurement Life-cycle Mgmt", "Real-time Pricing Engine", "Asset Tracking Implementation",
    "Blockchain Loyalty Program", "Telematics Data Platform", "Identity Management System"
  ];

  for (let i = 0; i < 30; i++) {
    const companyId = companyIds[i % 3];
    const name = dealNames[i];
    const amount = 50000 + Math.floor(Math.random() * 200000);
    const champion_id = contactIds[Math.floor(i % 15)]; // Use different contacts
    
    // Distribution Logic:
    // i in [0, 7] -> High
    // i in [8, 22] -> Medium
    // i in [23, 29] -> Low
    
    let stage = "";
    let demo = false;
    let champ = false;
    let age = 0;
    
    if (i < 8) { // HIGH (8)
      // High score needs: Late stage, Demo done, Champion identified, Low age/High activity
      stage = STAGES[Math.floor(Math.random() * 2) + 3]; // Decision Maker or Contract Sent
      demo = true;
      champ = true;
      age = 10 + Math.floor(Math.random() * 15);
    } else if (i < 23) { // MEDIUM (15)
      // Medium score needs: Mixed signals
      stage = STAGES[Math.floor(Math.random() * 2) + 1]; // Qualified or Presentation
      demo = Math.random() > 0.4;
      champ = Math.random() > 0.4;
      age = 20 + Math.floor(Math.random() * 40);
    } else { // LOW (7)
      // Low score needs: Early stage, No demo, Stuck/Stalled, High age
      stage = STAGES[0]; // Appointment Scheduled
      demo = false;
      champ = false;
      age = 45 + Math.floor(Math.random() * 30);
    }

    const created_at = new Date(2025, 11 + Math.floor(i/10), 5 + (i % 25)).toISOString(); // Dec - Jan - Feb
    const close_date = new Date(2026, 2, 28).toISOString(); // March close

    const dRes = await query(`
      INSERT INTO deals (
        name, amount, stage, created_at, close_date, company_id, 
        organization_id, demo_completed, champion_identified, champion_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
    `, [name, amount, stage, created_at, close_date, companyId, orgId, demo, champ, champion_id]);
    
    const dealId = dRes.rows[0].id;

    // Add tasks based on i (high activity for high scores)
    const taskCount = i < 8 ? (8 + Math.floor(Math.random() * 5)) : (i < 23 ? (3 + Math.floor(Math.random() * 4)) : 1);
    for (let j = 0; j < taskCount; j++) {
      const taskNames = ["Follow up email", "Technical review", "Stakeholder meeting", "Pricing discussion", "Discovery call"];
      const tName = taskNames[j % 5];
      await query(`
        INSERT INTO tasks (title, description, status, deal_id, organization_id, created_at, due_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [tName, "Professional sales activity", "Completed", dealId, orgId, created_at, created_at]);
    }
  }

  console.log("--- Generation Complete ---");
}

generateData().catch(console.error);
