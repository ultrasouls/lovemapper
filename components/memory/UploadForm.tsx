'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { extractExif } from '@/lib/exif';
import { uploadMemory } from '@/app/actions/memories';
import LocationPicker from '@/components/memory/LocationPicker';
import type { Visibility, CloudinaryUploadResult } from '@/lib/types';

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [takenAt, setTakenAt] = useState<string>('');
  const [needsLocation, setNeedsLocation] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'details' | 'location'>('select');

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 20MB)
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('Image must be under 20MB');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Generate preview
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);

    // Extract EXIF
    const exif = await extractExif(selectedFile);

    if (exif.latitude && exif.longitude) {
      setLatitude(exif.latitude);
      setLongitude(exif.longitude);
      setNeedsLocation(false);
    } else {
      setNeedsLocation(true);
    }

    if (exif.takenAt) {
      setTakenAt(new Date(exif.takenAt).toISOString().slice(0, 16));
    }

    setStep('details');
  }, []);

  const handleLocationSet = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setNeedsLocation(false);
    setStep('details');
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || latitude === null || longitude === null) return;

    setUploading(true);
    setError(null);

    try {
      // 1. Get signed upload params from our API
      const sigRes = await fetch('/api/cloudinary/signature', { method: 'POST' });
      const sigData = await sigRes.json();

      // 2. Upload directly to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sigData.apiKey);
      formData.append('timestamp', sigData.timestamp);
      formData.append('signature', sigData.signature);
      formData.append('folder', sigData.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );

      if (!uploadRes.ok) {
        throw new Error('Failed to upload image');
      }

      const cloudResult: CloudinaryUploadResult = await uploadRes.json();

      // 3. Save metadata to Supabase via server action
      const result = await uploadMemory({
        caption,
        latitude,
        longitude,
        visibility,
        photoUrl: cloudResult.secure_url,
        photoPublicId: cloudResult.public_id,
        takenAt: takenAt || undefined,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Success — go to map
      router.push('/map');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [file, caption, latitude, longitude, visibility, takenAt, router]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step 1: File Selection */}
      {step === 'select' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
        >
          <p className="text-5xl mb-4">📷</p>
          <p className="text-lg font-medium text-gray-700">Tap to select a photo</p>
          <p className="text-sm text-gray-400 mt-1">JPG, PNG, HEIC — max 20MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && preview && (
        <div className="space-y-6">
          {/* Preview */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-100">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-80 object-contain"
            />
            <button
              onClick={() => {
                setStep('select');
                setFile(null);
                setPreview(null);
                setLatitude(null);
                setLongitude(null);
              }}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 transition"
            >
              ✕
            </button>
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's this memory about?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-gray-900"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">When was this taken?</label>
            <input
              type="datetime-local"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-900"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Who can see this?</label>
            <div className="flex gap-2">
              {(['private', 'public'] as Visibility[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition ${
                    visibility === v
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {v === 'private' ? '🔒 Private' : '🌍 Public'}
                </button>
              ))}
            </div>
          </div>

          {/* Location status */}
          <div className="bg-gray-50 rounded-xl p-4">
            {latitude !== null && longitude !== null ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">📍 Location set</p>
                  <p className="text-xs text-gray-500">
                    {latitude.toFixed(4)}, {longitude.toFixed(4)}
                  </p>
                </div>
                <button
                  onClick={() => setStep('location')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-amber-700 font-medium mb-2">
                  📍 No location found in photo
                </p>
                <button
                  onClick={() => setStep('location')}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Set location on map
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</div>
          )}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={uploading || latitude === null || longitude === null}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition text-lg"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </span>
            ) : (
              'Save Memory'
            )}
          </button>
        </div>
      )}

      {/* Step 3: Location Picker */}
      {step === 'location' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Pick a location</h3>
            <button
              onClick={() => setStep('details')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>
          <p className="text-sm text-gray-500">Tap the map to set where this memory happened.</p>
          <LocationPicker
            initialLat={latitude}
            initialLng={longitude}
            onLocationSet={handleLocationSet}
          />
        </div>
      )}
    </div>
  );
}
