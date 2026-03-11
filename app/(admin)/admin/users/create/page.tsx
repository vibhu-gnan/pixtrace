import Link from 'next/link';
import { CreateUserForm } from './create-user-form';

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default function AdminCreateUserPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeftIcon />
        Back to Users
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create User</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new account with credentials and assign a plan.
        </p>
      </div>

      <CreateUserForm />
    </div>
  );
}
