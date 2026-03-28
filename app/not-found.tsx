import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-6xl mb-4">🗺️</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h2>
        <p className="text-gray-500 mb-6">This memory might have been deleted or the link is invalid.</p>
        <Link
          href="/map"
          className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition font-medium inline-block"
        >
          Go to your map
        </Link>
      </div>
    </div>
  );
}
