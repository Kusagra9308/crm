import { query } from '../lib/db';

async function migrate() {
    console.log('Starting migration: adding deal_id to tasks table...');
    try {
        await query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deal_id INTEGER REFERENCES deals(id);');
        console.log('Successfully added deal_id column to tasks table');
    } catch (err: any) {
        console.error('Migration failed:', err.message);
    }
    process.exit(0);
}

migrate();
