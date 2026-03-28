import FeedList from '@/components/feed/FeedList';

export default function FeedPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Memories</h2>
      <FeedList />
    </div>
  );
}
