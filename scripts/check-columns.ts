import { query } from './lib/db';

async function check() {
  console.log('--- Checking database columns for "tasks" ---');
  try {
    const res = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks'");
    const columns = res.rows.map(r => r.column_name);
    console.log('Columns in tasks:', columns.join(', '));
    
    if (columns.includes('deal_id')) {
      console.log('✅ deal_id column exists.');
    } else {
      console.log('❌ deal_id column MISSING!');
    }
  } catch (err) {
    console.error('Error checking columns:', err);
  }
  process.exit(0);
}

check();
