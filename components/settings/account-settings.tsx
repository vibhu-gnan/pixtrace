'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { OrganizerProfile } from '@/lib/auth/session';
import type { AuthInfo } from './settings-tabs';
import { changePassword, exportAccountData, deleteAccount } from '@/actions/settings';

interface AccountSettingsProps {
  organizer: OrganizerProfile;
  authInfo: AuthInfo;
}

export function AccountSettings({ organizer, authInfo }: AccountSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Linked Accounts */}
      <LinkedAccounts authInfo={authInfo} email={organizer.email} />

      {/* Password Change — only for email+password users */}
      {authInfo.hasEmailProvider && <PasswordChange />}

      {/* Danger Zone */}
      <DangerZone organizer={organizer} />
    </div>
  );
}

// ─── Linked Accounts ─────────────────────────────────────────

function LinkedAccounts({ authInfo, email }: { authInfo: AuthInfo; email: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Linked Accounts</h2>
      <div className="space-y-3">
        {authInfo.hasGoogleProvider && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Google</p>
              <p className="text-xs text-gray-500 truncate">{authInfo.googleEmail || email}</p>
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Connected</span>
          </div>
        )}

        {authInfo.hasEmailProvider && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <svg className="w-5 h-5 flex-shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <polyline points="3 7 12 13 21 7" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Email & Password</p>
              <p className="text-xs text-gray-500 truncate">{email}</p>
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Active</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Password Change ─────────────────────────────────────────

function PasswordChange() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await changePassword({ newPassword, confirmPassword });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500 sm:text-sm"
            placeholder="Min 8 characters"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500 sm:text-sm"
            placeholder="Re-enter new password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Password changed successfully!</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

// ─── Danger Zone ─────────────────────────────────────────────

function DangerZone({ organizer }: { organizer: OrganizerProfile }) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape key to close modal + body scroll lock
  const closeModal = useCallback(() => {
    if (!deleting) setShowDeleteModal(false);
  }, [deleting]);

  useEffect(() => {
    if (!showDeleteModal) return;
    // Lock body scroll
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showDeleteModal, closeModal]);

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const result = await exportAccountData();
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        // Download as JSON
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pixtrace-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setError('Failed to export data');
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const result = await deleteAccount(deleteConfirmEmail);
      if (result.error) {
        setError(result.error);
        setDeleting(false);
      } else {
        // Account deleted — redirect to sign-in
        router.push('/sign-in');
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700 mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Irreversible actions. Please proceed with caution.
        </p>

        <div className="space-y-4">
          {/* Export Data */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Export Data</p>
              <p className="text-sm text-gray-500">Download all your events, photos, and payment data as JSON</p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>

          {/* Delete Account */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Delete Account</p>
              <p className="text-sm text-gray-500">Permanently delete your account and all associated data</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Account</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete your account, all events, photos, and payment history.
              This action cannot be undone.
            </p>
            <div className="mb-4">
              <label htmlFor="deleteConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="font-mono text-red-600">{organizer.email}</span> to confirm
              </label>
              <input
                id="deleteConfirm"
                type="email"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-red-500 sm:text-sm"
                placeholder={organizer.email}
              />
            </div>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmEmail.toLowerCase().trim() !== organizer.email.toLowerCase()}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
