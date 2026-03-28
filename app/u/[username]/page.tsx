import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import PublicProfileMap from '@/components/map/PublicProfileMap';

interface Props {
  params: Promise<{ username: string }>;
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (!profile) {
    notFound();
  }

  // Fetch public memories
  const { data: memories } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', profile.id)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              '👤'
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">@{profile.username}</h1>
            {profile.full_name && (
              <p className="text-gray-500">{profile.full_name}</p>
            )}
            <p className="text-sm text-gray-400 mt-1">
              {memories?.length || 0} public {(memories?.length || 0) === 1 ? 'memory' : 'memories'}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      <PublicProfileMap memories={memories || []} username={profile.username} />
    </div>
  );
}
