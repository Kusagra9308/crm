import { query } from '../lib/db';

async function migrate() {
    console.log('Starting migration: adding champion_id to deals and ai_score to companies...');
    try {
        // 1. Add champion_id to deals
        await query('ALTER TABLE deals ADD COLUMN IF NOT EXISTS champion_id INTEGER REFERENCES contacts(id);');
        console.log('Successfully added champion_id column to deals table');

        // 2. Add ai_score to companies
        await query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_score FLOAT DEFAULT 0.5;');
        console.log('Successfully added ai_score column to companies table');

    } catch (err: any) {
        console.error('Migration failed:', err.message);
    }
    process.exit(0);
}

migrate();
