import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { fullResUrl } from '@/lib/cloudinary';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();

  const { data: memory } = await supabase
    .from('memories')
    .select('caption, photo_public_id')
    .eq('share_token', token)
    .single();

  if (!memory) {
    return { title: 'Memory not found — LoveMapper' };
  }

  return {
    title: `${memory.caption || 'A Memory'} — LoveMapper`,
    description: memory.caption || 'A shared memory on LoveMapper',
    openGraph: {
      images: [fullResUrl(memory.photo_public_id)],
    },
  };
}

export default async function SharedMemoryPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: memory } = await supabase
    .from('memories')
    .select('*, profiles(username)')
    .eq('share_token', token)
    .single();

  if (!memory) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-lg w-full">
        <img
          src={fullResUrl(memory.photo_public_id)}
          alt={memory.caption}
          className="w-full max-h-[60vh] object-contain bg-gray-100"
        />
        <div className="p-6">
          <p className="text-lg text-gray-900">{memory.caption || 'No caption'}</p>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            {memory.taken_at && (
              <span>📅 {new Date(memory.taken_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}</span>
            )}
            <span>📍 {memory.latitude.toFixed(4)}, {memory.longitude.toFixed(4)}</span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-400">
              Shared by @{memory.profiles?.username || 'unknown'} on{' '}
              <a href="/" className="text-blue-600 hover:text-blue-700 font-medium">LoveMapper</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
