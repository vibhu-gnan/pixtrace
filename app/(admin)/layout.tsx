import { requireAdmin } from '@/lib/admin/auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { RouteProgress } from '@/components/UI/route-progress';
import type { Metadata } from 'next';

// Admin console — never index.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizer = await requireAdmin();

  return (
    <>
      <RouteProgress />
      <AdminShell organizer={organizer}>
        {children}
      </AdminShell>
    </>
  );
}
