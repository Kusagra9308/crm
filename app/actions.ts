"use server";

import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { signIn, signOut, auth } from "@/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { syncTenantDeals } from "@/lib/hubspotClient";
import { getInsight } from "@/lib/utils";

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid credentials.";
        default:
          return "Something went wrong.";
      }
    }
    throw error;
  }
}

export async function logout() {
  await signOut();
}

export async function signUp(
  prevState: string | undefined,
  formData: FormData,
) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const orgName = (formData.get("orgName") as string) || `${name}'s Org`;

  if (!email || !password || !name) {
    return "Please fill in all fields.";
  }

  // Check if user exists
  const existingUser = await query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  if (existingUser.rows.length > 0) {
    return "User already exists.";
  }

  // Create Organization
  let orgId;
  try {
    const orgResult = await query(
      "INSERT INTO organizations (name) VALUES ($1) RETURNING id",
      [orgName],
    );
    orgId = orgResult.rows[0].id;
  } catch (error) {
    return "Failed to create organization.";
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user linked to Org
  try {
    await query(
      "INSERT INTO users (name, email, password, organization_id) VALUES ($1, $2, $3, $4)",
      [name, email, hashedPassword, orgId],
    );
  } catch (error) {
    return "Failed to create user.";
  }

  // Auto login after signup
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      return "Something went wrong during sign in.";
    }
    throw error;
  }
}

export async function updateProfile(prevState: any, formData: FormData) {
  const session = await auth();
  if (!session?.user?.email)
    return { message: "Not authenticated", success: false };

  const name = formData.get("name") as string;
  const newPassword = formData.get("newPassword") as string;
  const currentPassword = formData.get("currentPassword") as string;

  try {
    // If changing password
    if (newPassword) {
      if (!currentPassword)
        return {
          message: "Current password required to change password",
          success: false,
        };

      // Fetch user to get current hash
      const userRes = await query("SELECT * FROM users WHERE email = $1", [
        session.user.email,
      ]);
      const user = userRes.rows[0];

      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match)
        return { message: "Incorrect current password", success: false };

      const hashedNew = await bcrypt.hash(newPassword, 10);
      await query("UPDATE users SET password = $1 WHERE email = $2", [
        hashedNew,
        session.user.email,
      ]);
    }

    // Update name
    if (name && name !== session.user.name) {
      await query("UPDATE users SET name = $1 WHERE email = $2", [
        name,
        session.user.email,
      ]);
    }

    revalidatePath("/settings");
    revalidatePath("/"); // Update sidebar name
    return { message: "Profile updated successfully", success: true };
  } catch (error) {
    return { message: "Failed to update profile", success: false };
  }
}

// --- Companies Actions ---

export async function getCompanies() {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) return [];

  const result = await query(
    "SELECT * FROM companies WHERE organization_id = $1 ORDER BY created_at DESC",
    [orgId],
  );
  return result.rows;
}

export async function createCompany(formData: FormData) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const domain = formData.get("domain") as string;
  const industry = formData.get("industry") as string;
  const employees = formData.get("employees") as string;
  const revenue = formData.get("revenue") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const country = formData.get("country") as string;
  const description = formData.get("description") as string;
  const lifecycle_stage = formData.get("lifecycle_stage") as string;

  await query(
    `INSERT INTO companies (name, domain, industry, employees, revenue, city, state, country, description, lifecycle_stage, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      name,
      domain,
      industry,
      employees,
      revenue,
      city,
      state,
      country,
      description,
      lifecycle_stage,
      orgId,
    ],
  );

  revalidatePath("/companies");
}

export async function updateCompany(id: number, formData: FormData) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const domain = formData.get("domain") as string;
  const industry = formData.get("industry") as string;
  const employees = formData.get("employees") as string;
  const revenue = formData.get("revenue") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const country = formData.get("country") as string;
  const description = formData.get("description") as string;
  const lifecycle_stage = formData.get("lifecycle_stage") as string;

  await query(
    `UPDATE companies 
     SET name = $1, domain = $2, industry = $3, employees = $4, revenue = $5, city = $6, state = $7, country = $8, description = $9, lifecycle_stage = $10
     WHERE id = $11 AND organization_id = $12`,
    [
      name,
      domain,
      industry,
      employees,
      revenue,
      city,
      state,
      country,
      description,
      lifecycle_stage,
      id,
      orgId,
    ],
  );

  revalidatePath("/companies");
}

export async function deleteCompany(id: number) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  await query("DELETE FROM companies WHERE id = $1 AND organization_id = $2", [
    id,
    orgId,
  ]);
  revalidatePath("/companies");
}

// --- Contacts Actions ---

export async function getContacts() {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) return [];

  const result = await query(
    `
    SELECT contacts.*, companies.name as company_name 
    FROM contacts 
    LEFT JOIN companies ON contacts.company_id = companies.id 
    WHERE contacts.organization_id = $1
    ORDER BY contacts.created_at DESC
  `,
    [orgId],
  );
  return result.rows;
}

export async function createContact(formData: FormData) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const first_name = formData.get("first_name") as string;
  const last_name = formData.get("last_name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const job_title = formData.get("job_title") as string;
  const lifecycle_stage = formData.get("lifecycle_stage") as string;
  const company_id = formData.get("company_id")
    ? parseInt(formData.get("company_id") as string)
    : null;

  await query(
    `INSERT INTO contacts (first_name, last_name, email, phone, job_title, lifecycle_stage, company_id, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      first_name,
      last_name,
      email,
      phone,
      job_title,
      lifecycle_stage,
      company_id,
      orgId,
    ],
  );

  revalidatePath("/contacts");
}

export async function updateContact(id: number, formData: FormData) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const first_name = formData.get("first_name") as string;
  const last_name = formData.get("last_name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const job_title = formData.get("job_title") as string;
  const lifecycle_stage = formData.get("lifecycle_stage") as string;
  const company_id = formData.get("company_id")
    ? parseInt(formData.get("company_id") as string)
    : null;

  await query(
    `UPDATE contacts 
     SET first_name = $1, last_name = $2, email = $3, phone = $4, job_title = $5, lifecycle_stage = $6, company_id = $7
     WHERE id = $8 AND organization_id = $9`,
    [
      first_name,
      last_name,
      email,
      phone,
      job_title,
      lifecycle_stage,
      company_id,
      id,
      orgId,
    ],
  );

  revalidatePath("/contacts");
}

export async function deleteContact(id: number) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  await query("DELETE FROM contacts WHERE id = $1 AND organization_id = $2", [
    id,
    orgId,
  ]);
  revalidatePath("/contacts");
}

// --- Deals Actions ---

export async function getDeals() {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) return [];

  const result = await query(
    `
    SELECT deals.*, companies.name as company_name 
    FROM deals 
    LEFT JOIN companies ON deals.company_id = companies.id 
    WHERE deals.organization_id = $1
    ORDER BY deals.created_at DESC
  `,
    [orgId],
  );

  const deals = result.rows;

  return deals;
}

// --- Internal AI Helper ---
async function recalculateAiScore(dealId: number) {
  try {
    const dealRes = await query("SELECT * FROM deals WHERE id = $1", [dealId]);
    if (dealRes.rows.length === 0) return;
    const d = dealRes.rows[0];

    // Calculate Real Age and Urgency
    const deal_age = Math.floor((new Date().getTime() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const days_to_close = d.close_date ? Math.floor((new Date(d.close_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 30;

    // Dynamic Feature: Memory Density (Task Count)
    const ntRes = await query("SELECT COUNT(*) as count FROM tasks WHERE deal_id = $1", [dealId]);
    const note_count = parseInt(ntRes.rows[0].count);

    const pythonUrl = process.env.PYTHON_API_URL || "http://localhost:8000";
    const predictRes = await fetch(`${pythonUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: d.amount,
        stage: d.stage,
        note_count,
        deal_age,
        demo_completed: d.demo_completed,
        champion_identified: d.champion_identified,
        days_to_close
      }),
    });

    if (predictRes.ok) {
      const { ai_score } = await predictRes.json();
      if (ai_score !== null && ai_score !== undefined) {
        await query(`UPDATE deals SET ai_score = $1 WHERE id = $2`, [
          ai_score,
          dealId,
        ]);
        console.log(`[recalculateAiScore] Updated Deal ${dealId} -> ${ai_score}%`);
      }
    }
  } catch (err) {
    console.warn("[recalculateAiScore] Failed:", err);
  }
}

export async function createDeal(formData: FormData) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const amount = formData.get("amount")
    ? parseFloat(formData.get("amount") as string)
    : 0;
  const stage = formData.get("stage") as string;
  const close_date = formData.get("close_date") as string;
  const company_id = formData.get("company_id")
    ? parseInt(formData.get("company_id") as string)
    : null;

  const demo_completed = formData.get("demo_completed") === "true";
  const champion_identified = formData.get("champion_identified") === "true";

  const dealResult = await query(
    `INSERT INTO deals (
      name, amount, stage, close_date, company_id, organization_id, 
      demo_completed, champion_identified
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      name, amount, stage, close_date, company_id, orgId,
      demo_completed, champion_identified
    ],
  );

  const dealId = dealResult.rows[0]?.id;

  if (dealId) {
    await query(
      `INSERT INTO deal_stage_history (deal_id, stage)
       VALUES ($1, $2)`,
      [dealId, stage],
    );

    // Initial Score Calculation
    await recalculateAiScore(dealId);
  }

  revalidatePath("/deals");
}

export async function updateDeal(id: number, formData: FormData) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const amount = parseFloat(formData.get("amount") as string) || 0;
  const stage = formData.get("stage") as string;
  const demo_completed = formData.get("demo_completed") === "true";
  const champion_identified = formData.get("champion_identified") === "true";

  // Update DB
  await query(
    `UPDATE deals SET name = $1, amount = $2, stage = $3, demo_completed = $4, champion_identified = $5 
     WHERE id = $6 AND organization_id = $7`,
    [name, amount, stage, demo_completed, champion_identified, id, orgId]
  );

  // Recalculate AI Score on update
  await recalculateAiScore(id);

  revalidatePath("/deals");
}

export async function updateDealStage(id: number, stage: string) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const currentDeal = await query(
    "SELECT stage FROM deals WHERE id = $1 AND organization_id = $2",
    [id, orgId],
  );

  const currentStage = currentDeal.rows[0]?.stage;

  if (!currentStage || currentStage === stage) {
    revalidatePath("/deals");
    return;
  }

  const updatedDeal = await query(
    "UPDATE deals SET stage = $1 WHERE id = $2 AND organization_id = $3 RETURNING id",
    [stage, id, orgId],
  );

  if (updatedDeal.rows[0]?.id) {
    await query(
      `INSERT INTO deal_stage_history (deal_id, stage)
       VALUES ($1, $2)`,
      [id, stage],
    );
    // Stage changed -> recalculate AI score
    await recalculateAiScore(id);
  }

  revalidatePath("/deals");
}

export async function deleteDeal(id: number) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  await query("DELETE FROM deals WHERE id = $1 AND organization_id = $2", [
    id,
    orgId,
  ]);
  revalidatePath("/deals");
}

// --- Tasks Actions ---

export async function getTasks() {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) return [];

  const result = await query(
    `
    SELECT tasks.*, 
           contacts.first_name as contact_first_name, contacts.last_name as contact_last_name,
           companies.name as company_name,
           deals.name as deal_name
    FROM tasks 
    LEFT JOIN contacts ON tasks.contact_id = contacts.id
    LEFT JOIN companies ON tasks.company_id = companies.id
    LEFT JOIN deals ON tasks.deal_id = deals.id
    WHERE tasks.organization_id = $1
    ORDER BY tasks.due_date ASC
  `,
    [orgId],
  );
  return result.rows;
}

export async function createTask(formData: FormData) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const due_date = formData.get("due_date") as string;
  const priority = formData.get("priority") as string;
  const contact_id = formData.get("contact_id") ? parseInt(formData.get("contact_id") as string) : null;
  const company_id = formData.get("company_id") ? parseInt(formData.get("company_id") as string) : null;
  const deal_id = formData.get("deal_id") ? parseInt(formData.get("deal_id") as string) : null;

  await query(
    `INSERT INTO tasks (title, description, due_date, priority, contact_id, company_id, deal_id, organization_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [title, description, due_date, priority, contact_id, company_id, deal_id, orgId],
  );

  revalidatePath("/tasks");
  if (deal_id) await recalculateAiScore(deal_id);
}

export async function updateTaskStatus(id: number, status: string) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  // Get task info before updating
  const taskRes = await query("SELECT title, deal_id FROM tasks WHERE id = $1", [id]);
  const task = taskRes.rows[0];

  await query(
    "UPDATE tasks SET status = $1 WHERE id = $2 AND organization_id = $3",
    [status, id, orgId],
  );

  // Automation: If task title contains 'demo' and marked as Completed, update deal flag
  if (task && task.deal_id && status === 'Completed') {
    const title = task.title.toLowerCase();
    if (title.includes("demo")) {
      await query("UPDATE deals SET demo_completed = TRUE WHERE id = $1", [task.deal_id]);
      console.log(`[Task-Automation] Demo completed for Deal ${task.deal_id}`);
    } else if (title.includes("champion") || title.includes("decision maker")) {
      await query("UPDATE deals SET champion_identified = TRUE WHERE id = $1", [task.deal_id]);
      console.log(`[Task-Automation] Champion identified for Deal ${task.deal_id}`);
    }
    
    // Always recalculate score after a status change (might change momentum)
    await recalculateAiScore(task.deal_id);
  }

  revalidatePath("/tasks");
  revalidatePath("/deals");
}

export async function deleteTask(id: number) {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId) throw new Error("Unauthorized");

  const taskRes = await query("SELECT deal_id FROM tasks WHERE id = $1", [id]);
  const deal_id = taskRes.rows[0]?.deal_id;

  await query("DELETE FROM tasks WHERE id = $1 AND organization_id = $2", [
    id,
    orgId,
  ]);
  revalidatePath("/tasks");
  if (deal_id) await recalculateAiScore(deal_id);
}

// --- Dashboard Actions ---

export async function getDashboardStats() {
  const session = await auth();
  let insight = null;
  const orgId = (session?.user as any)?.organization_id;
  if (!orgId)
    return {
      totalRevenue: 0,
      activeContacts: 0,
      pipelineValue: 0,
      predictedRevenue: 0,
      pendingTasks: 0,
      recentActivity: [],
      revenueChartData: [],
      insight: null,
      revenueChange: "0%",
      contactsChange: "0%",
      pipelineChange: "0%",
      tasksChange: "0%",
      predictedChange: "0%",
    };

  // Total Revenue (Sum of Closed Won deals)
  const revenueResult = await query(
    `
    SELECT SUM(amount) as total 
    FROM deals 
    WHERE stage = 'Closed Won' AND organization_id = $1
  `,
    [orgId],
  );
  const totalRevenue = revenueResult.rows[0].total || 0;

  // Active Contacts Count
  const contactsResult = await query(
    "SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1",
    [orgId],
  );
  const activeContacts = contactsResult.rows[0].count;

  const pipelineResult = await query(
    `
    SELECT 
        SUM(amount) as total,
        SUM(amount * COALESCE(ai_score, 0) / 100) as weighted,
        AVG(COALESCE(ai_score, 0)) as health 
    FROM deals 
    WHERE stage != 'Closed Won' AND stage != 'Closed Lost' AND organization_id = $1
  `,
    [orgId],
  );
  const pipelineValue = pipelineResult.rows[0].total || 0;
  const weightedRevenue = pipelineResult.rows[0].weighted || 0;
  const pipelineHealth = pipelineResult.rows[0].health || 0;

  const openDeals = await query(
    `
SELECT * FROM deals 
WHERE stage != 'Closed Won' AND stage != 'Closed Lost'
AND organization_id = $1
`,
    [orgId],
  );

  const predictedRevenue = weightedRevenue; // Now using the database-stored weighted revenue (amount * ai_score / 100)

  console.log("Predicted Revenue:", predictedRevenue);

  // Meetings/Tasks Count (Pending tasks)
  const tasksResult = await query(
    "SELECT COUNT(*) as count FROM tasks WHERE status = 'Pending' AND organization_id = $1",
    [orgId],
  );
  const pendingTasks = tasksResult.rows[0].count;

  // Recent Activity (Last 5 actions across tables)
  const recentActivityResult = await query(
    `
    (SELECT 'deal' as type, name as title, created_at FROM deals WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 3)
    UNION ALL
    (SELECT 'task' as type, title as title, created_at FROM tasks WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 3)
    ORDER BY created_at DESC
    LIMIT 5
  `,
    [orgId],
  );
  const recentActivity = recentActivityResult.rows;

  // Revenue by Month (for Chart)
  const revenueByMonthResult = await query(
    `
    SELECT TO_CHAR(close_date, 'Mon') as name, SUM(amount) as value
    FROM deals 
    WHERE stage = 'Closed Won' 
      AND close_date >= NOW() - INTERVAL '12 months'
      AND organization_id = $1
    GROUP BY 1, TO_CHAR(close_date, 'YYYY-MM')
    ORDER BY TO_CHAR(close_date, 'YYYY-MM')
  `,
    [orgId],
  );
  const revenueChartData = revenueByMonthResult.rows;
  // Exclude current month from insight calculation as it is incomplete and skews trends
  insight = getInsight(revenueChartData.slice(0, -1));

  // Calculate real trends
  const currentMonthRevenue = await query(
    "SELECT SUM(amount) as total FROM deals WHERE stage = 'Closed Won' AND organization_id = $1 AND close_date >= DATE_TRUNC('month', NOW())",
    [orgId]
  ).then(r => r.rows[0].total || 0);

  const lastMonthRevenue = await query(
    "SELECT SUM(amount) as total FROM deals WHERE stage = 'Closed Won' AND organization_id = $1 AND close_date >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND close_date < DATE_TRUNC('month', NOW())",
    [orgId]
  ).then(r => r.rows[0].total || 0);

  const calcChange = (current: number, previous: number) => {
    if (previous === 0 && current > 0) return "+100%";
    if (previous === 0) return "0%";
    const pct = ((current - previous) / previous) * 100;
    return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  };

  const revenueChange = calcChange(Number(currentMonthRevenue), Number(lastMonthRevenue));

  // Contacts Trend
  const currentMonthContacts = await query(
    "SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW())",
    [orgId]
  ).then(r => parseInt(r.rows[0].count));

  const lastMonthContacts = await query(
    "SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', NOW())",
    [orgId]
  ).then(r => parseInt(r.rows[0].count));

  const contactsChange = calcChange(currentMonthContacts, lastMonthContacts);

  // Pipeline Trend (Newly added deals value this month vs last)
  const currentPipelineNew = await query(
    "SELECT SUM(amount) as total FROM deals WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW()) AND stage NOT IN ('Closed Won', 'Closed Lost')",
    [orgId]
  ).then(r => Number(r.rows[0].total) || 0);

  const lastPipelineNew = await query(
    "SELECT SUM(amount) as total FROM deals WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', NOW()) AND stage NOT IN ('Closed Won', 'Closed Lost')",
    [orgId]
  ).then(r => Number(r.rows[0].total) || 0);

  const pipelineChange = calcChange(currentPipelineNew, lastPipelineNew);

  // Task volume trend
  const currentMonthTasks = await query(
    "SELECT COUNT(*) as count FROM tasks WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW())",
    [orgId]
  ).then(r => parseInt(r.rows[0].count));

  const lastMonthTasks = await query(
    "SELECT COUNT(*) as count FROM tasks WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', NOW())",
    [orgId]
  ).then(r => parseInt(r.rows[0].count));

  const tasksChange = calcChange(currentMonthTasks, lastMonthTasks);

  return {
    totalRevenue,
    activeContacts,
    pipelineValue,
    predictedRevenue,
    pendingTasks,
    recentActivity,
    revenueChartData,
    insight,
    revenueChange,
    contactsChange,
    pipelineChange,
    tasksChange,
    predictedChange: insight ? `${insight.change > 0 ? "+" : ""}${insight.change}%` : "0%",
    weightedRevenue,
    pipelineHealth: Math.round(pipelineHealth)
  };
}

// Team Actions
export async function getTeamMembers() {
  const session = await auth();
  const user = session?.user as any;
  if (!user || !user.organization_id) {
    return { members: [], invitations: [] };
  }

  const result = await query(
    `SELECT id, name, email, created_at FROM users WHERE organization_id = $1 ORDER BY created_at DESC`,
    [user.organization_id],
  );

  const invitations = await query(
    `SELECT id, email, status, created_at FROM invitations WHERE organization_id = $1 ORDER BY created_at DESC`,
    [user.organization_id],
  );

  return {
    members: result.rows,
    invitations: invitations.rows,
  };
}

export async function inviteUser(formData: FormData) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || !user.organization_id) {
    return { message: "Unauthorized", success: false };
  }

  const email = formData.get("email") as string;

  // Check if user already exists
  const existingUser = await query(`SELECT id FROM users WHERE email = $1`, [
    email,
  ]);
  if (existingUser.rows.length > 0) {
    return { message: "User already exists", success: false };
  }

  // Check if invitation already exists
  const existingInvite = await query(
    `SELECT id FROM invitations WHERE email = $1`,
    [email],
  );
  if (existingInvite.rows.length > 0) {
    return { message: "Invitation already sent", success: false };
  }

  const token =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  try {
    await query(
      `INSERT INTO invitations (email, organization_id, token) VALUES ($1, $2, $3)`,
      [email, user.organization_id, token],
    );
    revalidatePath("/settings/team");
    return { message: "Invitation sent successfully", success: true };
  } catch (error) {
    return { message: "Failed to send invitation", success: false };
  }
}

export async function revokeInvitation(id: number) {
  const session = await auth();
  const user = session?.user as any;
  if (!user || !user.organization_id) {
    return { message: "Unauthorized", success: false };
  }

  try {
    await query(
      `DELETE FROM invitations WHERE id = $1 AND organization_id = $2`,
      [id, user.organization_id],
    );
    revalidatePath("/settings/team");
    return { message: "Invitation revoked", success: true };
  } catch (error) {
    return { message: "Failed to revoke invitation", success: false };
  }
}

// --- HubSpot Integrations ---

export async function syncFromHubSpot() {
  const session = await auth();
  const orgId = (session?.user as any)?.organization_id;

  if (!orgId) {
    throw new Error("Unauthorized: Must be logged in to sync deals");
  }

  try {
    const totalSynced = await syncTenantDeals(orgId);
    revalidatePath("/deals");
    revalidatePath("/dashboard");
    return { success: true, count: totalSynced };
  } catch (error: any) {
    console.error("HubSpot Sync Failed:", error);
    return { success: false, message: error.message };
  }
}
