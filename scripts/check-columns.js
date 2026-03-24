require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks'");
        console.log('Tasks columns:', res.rows.map((r) => r.column_name));
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

check();
