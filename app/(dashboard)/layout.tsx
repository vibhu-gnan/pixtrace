import { redirect } from 'next/navigation';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getOrganizerPlanLimits } from '@/lib/plans/limits';
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

  const planLimits = await getOrganizerPlanLimits(organizer.id);

  return (
    <DashboardShell organizer={organizer} planLimits={planLimits}>
      {children}
    </DashboardShell>
  );
}
