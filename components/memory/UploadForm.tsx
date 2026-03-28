'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { extractExif } from '@/lib/exif';
import { uploadMemory } from '@/app/actions/memories';
import LocationPicker from '@/components/memory/LocationPicker';
import type { Visibility, CloudinaryUploadResult } from '@/lib/types';

interface FileWithPreview {
  file: File;
  preview: string;
  takenAt: string;
  // Per-file EXIF location (may differ across files)
  exifLat: number | null;
  exifLng: number | null;
}

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'details' | 'location'>('select');

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setError(null);
    const newFiles: FileWithPreview[] = [];
    let firstLat: number | null = null;
    let firstLng: number | null = null;
    let firstDate = '';

    for (const file of selectedFiles) {
      // Validate
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 20 * 1024 * 1024) {
        setError(`"${file.name}" is over 20MB and was skipped`);
        continue;
      }

      const preview = URL.createObjectURL(file);
      const exif = await extractExif(file);

      // Use first file's EXIF location as the shared location
      if (firstLat === null && exif.latitude && exif.longitude) {
        firstLat = exif.latitude;
        firstLng = exif.longitude;
      }
      if (!firstDate && exif.takenAt) {
        firstDate = new Date(exif.takenAt).toISOString().slice(0, 16);
      }

      newFiles.push({
        file,
        preview,
        takenAt: exif.takenAt ? new Date(exif.takenAt).toISOString().slice(0, 16) : '',
        exifLat: exif.latitude,
        exifLng: exif.longitude,
      });
    }

    if (newFiles.length === 0) {
      setError('No valid image files selected');
      return;
    }

    setFiles(newFiles);

    if (firstLat !== null && firstLng !== null) {
      setLatitude(firstLat);
      setLongitude(firstLng);
    }

    setStep('details');
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setStep('select');
        setLatitude(null);
        setLongitude(null);
      }
      return updated;
    });
  }, []);

  const handleLocationSet = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setStep('details');
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0 || latitude === null || longitude === null) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const fileItem = files[i];
        setUploadProgress(i + 1);

        // 1. Get signed upload params
        const sigRes = await fetch('/api/cloudinary/signature', { method: 'POST' });
        const sigData = await sigRes.json();

        // 2. Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', fileItem.file);
        formData.append('api_key', sigData.apiKey);
        formData.append('timestamp', sigData.timestamp);
        formData.append('signature', sigData.signature);
        formData.append('folder', sigData.folder);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
          { method: 'POST', body: formData }
        );

        if (!uploadRes.ok) {
          throw new Error(`Failed to upload "${fileItem.file.name}"`);
        }

        const cloudResult: CloudinaryUploadResult = await uploadRes.json();

        // 3. Save to Supabase — use per-file EXIF location if available, otherwise shared location
        const fileLat = fileItem.exifLat ?? latitude;
        const fileLng = fileItem.exifLng ?? longitude;

        const result = await uploadMemory({
          caption,
          latitude: fileLat,
          longitude: fileLng,
          visibility,
          photoUrl: cloudResult.secure_url,
          photoPublicId: cloudResult.public_id,
          takenAt: fileItem.takenAt || undefined,
        });

        if (result.error) {
          throw new Error(result.error);
        }
      }

      // All uploaded — go to map
      router.push('/map');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [files, caption, latitude, longitude, visibility, router]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step 1: File Selection */}
      {step === 'select' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
        >
          <p className="text-5xl mb-4">📷</p>
          <p className="text-lg font-medium text-gray-700">Tap to select photos</p>
          <p className="text-sm text-gray-400 mt-1">Select one or more — JPG, PNG, HEIC — max 20MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: Details */}
      {step === 'details' && files.length > 0 && (
        <div className="space-y-6">
          {/* Photo previews */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                {files.length} {files.length === 1 ? 'photo' : 'photos'} selected
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add more
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const newSelected = Array.from(e.target.files || []);
                  const newFiles: FileWithPreview[] = [];
                  for (const file of newSelected) {
                    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) continue;
                    const preview = URL.createObjectURL(file);
                    const exif = await extractExif(file);
                    newFiles.push({
                      file,
                      preview,
                      takenAt: exif.takenAt ? new Date(exif.takenAt).toISOString().slice(0, 16) : '',
                      exifLat: exif.latitude,
                      exifLng: exif.longitude,
                    });
                  }
                  setFiles((prev) => [...prev, ...newFiles]);
                }}
                className="hidden"
              />
            </div>

            <div className={`grid gap-2 ${files.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {files.map((f, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden bg-gray-100 aspect-square group">
                  <img
                    src={f.preview}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/70 transition opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                  {f.exifLat && f.exifLng && (
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      📍 GPS
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Caption — shared across all photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Caption (shared)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's this memory about?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-gray-900"
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
                  {files.some((f) => f.exifLat && f.exifLng) && files.length > 1 && (
                    <p className="text-xs text-blue-500 mt-1">
                      Photos with GPS data will use their own coordinates
                    </p>
                  )}
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
                  📍 No location found in photos
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
                Uploading {uploadProgress} of {files.length}...
              </span>
            ) : (
              `Save ${files.length === 1 ? 'Memory' : `${files.length} Memories`}`
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
          <p className="text-sm text-gray-500">Tap the map to set where {files.length === 1 ? 'this memory' : 'these memories'} happened.</p>
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
