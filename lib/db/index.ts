import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Lazy initialization — only create the connection when actually used
// This prevents resource leaks since the project uses Supabase JS client
// for all queries (direct Postgres connections fail on campus/mobile networks)
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const queryClient = postgres(process.env.DATABASE_URL, {
      prepare: false,
      idle_timeout: 20,
      max: 3, // Low limit since this is rarely used
    });
    _db = drizzle(queryClient, { schema });
  }
  return _db;
}

// Legacy export — kept for backward compatibility but now lazy-initialized
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

// Type exports
export type Organizer = typeof schema.organizers.$inferSelect;
export type Event = typeof schema.events.$inferSelect;
export type Album = typeof schema.albums.$inferSelect;
export type Media = typeof schema.media.$inferSelect;

export type NewOrganizer = typeof schema.organizers.$inferInsert;
export type NewEvent = typeof schema.events.$inferInsert;
export type NewAlbum = typeof schema.albums.$inferInsert;
export type NewMedia = typeof schema.media.$inferInsert;
