import { redirect } from 'next/navigation';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizer = await getCurrentOrganizer();

  if (!organizer) {
    redirect('/sign-in');
  }

  return <DashboardShell organizer={organizer}>{children}</DashboardShell>;
}
