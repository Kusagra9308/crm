import { query } from '../lib/db';
import bcrypt from 'bcryptjs';
import 'dotenv/config'

async function migrate() {
  try {
    console.log('Starting migration...');

    // Drop existing tables if they exist to ensure clean state with new schema
    await query(`DROP TABLE IF EXISTS tasks CASCADE;`);
    await query(`DROP TABLE IF EXISTS deals CASCADE;`);
    await query(`DROP TABLE IF EXISTS contacts CASCADE;`);
    await query(`DROP TABLE IF EXISTS companies CASCADE;`);
    await query(`DROP TABLE IF EXISTS users CASCADE;`);
    await query(`DROP TABLE IF EXISTS invitations CASCADE;`);
    await query(`DROP TABLE IF EXISTS organizations CASCADE;`);

    // Create Organizations table
    await query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created organizations table');

    // Create Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        organization_id INTEGER REFERENCES organizations(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created users table');

    // Create Invitations table
    await query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending', -- Pending, Accepted
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id)
      );
    `);
    console.log('Created invitations table');

    // Create Companies table
    await query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        address VARCHAR(255),
        city VARCHAR(255),
        state VARCHAR(255),
        country VARCHAR(255),
        industry VARCHAR(255),
        employees VARCHAR(50),
        revenue VARCHAR(50),
        description TEXT,
        about_us TEXT,
        lifecycle_stage VARCHAR(50) DEFAULT 'Subscriber',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        close_date TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id)
      );
    `);
    console.log('Created companies table');

    // Create Contacts table
    await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        job_title VARCHAR(255),
        company_id INTEGER REFERENCES companies(id),
        lifecycle_stage VARCHAR(50) DEFAULT 'Lead',
        hubspot_score INTEGER DEFAULT 0,
        original_source VARCHAR(255),
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id)
      );
    `);
    console.log('Created contacts table');

    // Create Deals table
    await query(`
      CREATE TABLE IF NOT EXISTS deals (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2),
        stage VARCHAR(50) NOT NULL,
        owner VARCHAR(255),
        close_date TIMESTAMP,
        company_id INTEGER REFERENCES companies(id),
        ai_score FLOAT,
        email_response_rate FLOAT DEFAULT 0.5,
        discount_requested FLOAT DEFAULT 0.1,
        demo_completed BOOLEAN DEFAULT FALSE,
        champion_identified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id)
      );
    `);
    console.log('Created deals table');

    // Create Tasks table
    await query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        due_date TIMESTAMP,
        priority VARCHAR(50) DEFAULT 'Medium',
        status VARCHAR(50) DEFAULT 'Pending',
        contact_id INTEGER REFERENCES contacts(id),
        company_id INTEGER REFERENCES companies(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        organization_id INTEGER REFERENCES organizations(id)
      );
    `);
    console.log('Created tasks table');

    // Create Deal Stage History table
    await query(`
      CREATE TABLE IF NOT EXISTS deal_stage_history (
        id SERIAL PRIMARY KEY,
        deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
        stage VARCHAR(50) NOT NULL,
        entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created deal_stage_history table');

    // Seed Data

    // Seed Data

    // 1. Create Default Organization
    const orgResult = await query(`
      INSERT INTO organizations (name) VALUES ('Demo Corp') RETURNING id;
    `);
    const orgId = orgResult.rows[0].id;
    console.log('Seeded organization');

    // 2. Seed User linked to Org
    const hashedPassword = await bcrypt.hash('password123', 10);
    await query(`
      INSERT INTO users (name, email, password, organization_id)
      VALUES ('Demo User', 'user@example.com', $1, $2)
      ON CONFLICT (email) DO NOTHING;
    `, [hashedPassword, orgId]);
    console.log('Seeded users');

    // 3. Seed Companies linked to Org
    await query(`
      INSERT INTO companies (name, domain, city, state, country, industry, employees, revenue, lifecycle_stage, organization_id)
      VALUES 
        ('TechCorp Inc.', 'techcorp.com', 'San Francisco', 'CA', 'USA', 'Technology', '100-500', '$10M - $50M', 'Customer', $1),
        ('Design Studio', 'designstudio.co', 'New York', 'NY', 'USA', 'Creative Services', '10-50', '$1M - $5M', 'Subscriber', $1),
        ('Marketing Pros', 'marketingpros.io', 'Austin', 'TX', 'USA', 'Marketing', '50-100', '$5M - $10M', 'Lead', $1)
      ON CONFLICT DO NOTHING;
    `, [orgId]);
    console.log('Seeded companies');

    // 4. Seed Contacts linked to Org
    await query(`
      INSERT INTO contacts (first_name, last_name, email, phone, job_title, company_id, lifecycle_stage, hubspot_score, original_source, organization_id)
      VALUES 
        ('Alice', 'Freeman', 'alice@example.com', '+1 (555) 123-4567', 'CTO', 1, 'Customer', 85, 'Organic Search', $1),
        ('Bob', 'Smith', 'bob@example.com', '+1 (555) 987-6543', 'Creative Director', 2, 'Subscriber', 40, 'Social Media', $1),
        ('Charlie', 'Brown', 'charlie@example.com', '+1 (555) 456-7890', 'Marketing Manager', 3, 'Lead', 60, 'Referral', $1)
      ON CONFLICT DO NOTHING;
    `, [orgId]);
    console.log('Seeded contacts');

    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
