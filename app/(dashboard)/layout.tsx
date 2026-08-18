import { redirect } from 'next/navigation';
import { getCurrentOrganizer } from '@/lib/auth/session';
import { getOrganizerPlanLimits } from '@/lib/plans/limits';
import { checkAndSetGracePeriod } from '@/lib/plans/grace-period';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { RouteProgress } from '@/components/UI/route-progress';
import type { Metadata } from 'next';

// Authenticated app surface — never index, even if a URL leaks into a backlink.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

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

  // Fire-and-forget: detect storage overage and set/clear grace period
  checkAndSetGracePeriod(organizer.id).catch((err) => {
    console.error('Grace period check failed on dashboard load:', err);
  });

  return (
    <>
      <RouteProgress />
      <DashboardShell organizer={organizer} planLimits={planLimits}>
        {children}
      </DashboardShell>
    </>
  );
}
