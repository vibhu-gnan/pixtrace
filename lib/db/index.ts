import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Connection for queries (prepare: false required for Supabase pgbouncer)
const queryClient = postgres(process.env.DATABASE_URL, { prepare: false });
export const db = drizzle(queryClient, { schema });

// Type exports
export type Organizer = typeof schema.organizers.$inferSelect;
export type Event = typeof schema.events.$inferSelect;
export type Album = typeof schema.albums.$inferSelect;
export type Media = typeof schema.media.$inferSelect;

export type NewOrganizer = typeof schema.organizers.$inferInsert;
export type NewEvent = typeof schema.events.$inferInsert;
export type NewAlbum = typeof schema.albums.$inferInsert;
export type NewMedia = typeof schema.media.$inferInsert;
