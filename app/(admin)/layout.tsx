import { requireAdmin } from '@/lib/admin/auth';
import { AdminShell } from '@/components/admin/admin-shell';
import { RouteProgress } from '@/components/UI/route-progress';

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
