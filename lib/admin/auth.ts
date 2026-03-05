import { getCurrentOrganizer, type OrganizerProfile } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

/**
 * Comma-separated admin email whitelist from env.
 * Parsed once at module load — fine for serverless (one parse per cold start).
 */
const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * Pure check — is this organizer an admin?
 * True if they have the database flag OR their email is in the env whitelist.
 */
export function isAdmin(organizer: OrganizerProfile): boolean {
  return organizer.is_admin === true || ADMIN_EMAILS.has(organizer.email.toLowerCase());
}

/**
 * Server-side guard for admin routes and server actions.
 * Redirects unauthenticated users to /sign-in and non-admins to /dashboard.
 */
export async function requireAdmin(): Promise<OrganizerProfile> {
  const organizer = await getCurrentOrganizer();

  if (!organizer) {
    redirect('/sign-in');
  }

  if (!isAdmin(organizer)) {
    redirect('/dashboard');
  }

  return organizer;
}
