'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { OrganizerProfile } from '@/lib/auth/session';
import type { AuthInfo } from './settings-tabs';
import { updateProfile } from '@/actions/settings';

interface ProfileFormProps {
  organizer: OrganizerProfile;
  authInfo: AuthInfo;
}

export function ProfileForm({ organizer, authInfo }: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(organizer.name || '');
  const [phone, setPhone] = useState(organizer.phone || '');
  const [businessName, setBusinessName] = useState(organizer.business_name || '');
  const [avatarUrl, setAvatarUrl] = useState(organizer.avatar_url || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const displayAvatar = avatarPreview || avatarUrl;

  // Clean up objectURL on unmount or when preview changes to prevent memory leak
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar must be less than 2MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Get presigned URL
      const res = await fetch('/api/upload/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });

      if (!res.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, key } = await res.json();

      // Upload to R2
      const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: file });
      if (!uploadRes.ok) throw new Error('Upload failed');

      // Revoke old objectURL before creating a new one
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(URL.createObjectURL(file));
      setAvatarUrl(key);
    } catch {
      setError('Failed to upload avatar. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarPreview]);

  function handleResetToGoogle() {
    if (authInfo.googleAvatarUrl) {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarUrl(authInfo.googleAvatarUrl);
      setAvatarPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateProfile({
        name,
        phone: phone || null,
        businessName: businessName || null,
        avatarUrl: avatarUrl || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Photo</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayAvatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center border-2 border-gray-200">
                <span className="text-2xl font-bold text-white">
                  {(name || organizer.email)?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload Photo'}
            </button>
            {authInfo.hasGoogleProvider && authInfo.googleAvatarUrl && avatarUrl !== authInfo.googleAvatarUrl && (
              <button
                type="button"
                onClick={handleResetToGoogle}
                className="block text-sm text-brand-600 hover:text-brand-700"
              >
                Reset to Google photo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500 sm:text-sm"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={organizer.email}
              disabled
              className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-500 bg-gray-50 ring-1 ring-gray-200 sm:text-sm cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500 sm:text-sm"
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
              Business Name
            </label>
            <input
              id="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={255}
              className="w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 ring-1 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500 sm:text-sm"
              placeholder="Your studio or business name"
            />
          </div>
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">Profile updated successfully!</p>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || uploading}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : uploading ? 'Wait for upload...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
