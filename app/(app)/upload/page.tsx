import UploadForm from '@/components/memory/UploadForm';

export default function UploadPage() {
  return (
    <div className="px-4 py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 max-w-2xl mx-auto">Upload Memory</h2>
      <UploadForm />
    </div>
  );
}
