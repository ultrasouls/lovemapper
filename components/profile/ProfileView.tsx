'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
      setUsername(data.username);
      setFullName(data.full_name || '');
    }

    // Get memory count
    const { count } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    setMemoryCount(count || 0);
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('profiles')
      .update({ username, full_name: fullName || null })
      .eq('id', profile.id);

    if (err) {
      setError(err.message);
    } else {
      setProfile({ ...profile, username, full_name: fullName || null });
      setEditing(false);
    }
    setSaving(false);
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Avatar + stats */}
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center text-4xl mx-auto mb-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            '👤'
          )}
        </div>
        <h2 className="text-xl font-bold text-gray-900">@{profile.username}</h2>
        {profile.full_name && (
          <p className="text-gray-500">{profile.full_name}</p>
        )}
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{memoryCount}</p>
            <p className="text-xs text-gray-500">memories</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs text-gray-500">joined</p>
          </div>
        </div>
      </div>

      {/* Public profile link */}
      <div className="bg-blue-50 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-700">
          🌍 Your public profile:{' '}
          <a
            href={`/u/${profile.username}`}
            className="font-medium underline"
            target="_blank"
          >
            /u/{profile.username}
          </a>
        </p>
        <p className="text-xs text-blue-500 mt-1">
          Only your public memories are visible there.
        </p>
      </div>

      {/* Edit form */}
      {editing ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition font-medium"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setUsername(profile.username);
                setFullName(profile.full_name || '');
              }}
              className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
        >
          ✏️ Edit profile
        </button>
      )}
    </div>
  );
}
