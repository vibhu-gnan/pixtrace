import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not defined');
    process.exit(1);
}

const sql = postgres(connectionString, { ssl: 'require' });

async function migrate() {
    try {
        console.log('Testing connection...');
        const result = await sql`SELECT 1 as connected`;
        console.log('Connection successful:', result);

        console.log('Adding slug column to events table...');
        await sql`
      ALTER TABLE events 
      ADD COLUMN IF NOT EXISTS slug text UNIQUE;
    `;
        console.log('Successfully added slug column.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sql.end();
    }
}

migrate();
