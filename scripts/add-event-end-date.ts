
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not defined');
    process.exit(1);
}

// Bypass pooler for direct DDL if needed, but usually pooler is fine for simple adds unless transaction mode issues.
// Trying standard connection string.
const sql = postgres(connectionString, { ssl: 'require' });

async function migrate() {
    try {
        console.log('Connecting to database...');
        // Simple query to verify connection
        await sql`SELECT 1`;
        console.log('Connection successful.');

        console.log('Adding event_end_date column to events table...');

        await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS event_end_date timestamp;
    `;

        console.log('Successfully added event_end_date column.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

migrate();
