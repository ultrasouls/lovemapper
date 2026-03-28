'use client';

import { useState } from 'react';
import { fullResUrl } from '@/lib/cloudinary';
import { updateMemory, deleteMemory, generateShareLink } from '@/app/actions/memories';
import type { Memory, Visibility } from '@/lib/types';

interface MemoryDetailProps {
  memory: Memory;
  onClose: () => void;
  onUpdate: (memory: Memory) => void;
  onDelete: (id: string) => void;
}

export default function MemoryDetail({ memory, onClose, onUpdate, onDelete }: MemoryDetailProps) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(memory.caption);
  const [visibility, setVisibility] = useState<Visibility>(memory.visibility);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    memory.share_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/memory/share/${memory.share_token}` : null
  );
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateMemory({
      id: memory.id,
      caption,
      visibility,
    });
    if (result.memory) {
      onUpdate(result.memory);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setSaving(true);
    const result = await deleteMemory(memory.id);
    if (!result.error) {
      onDelete(memory.id);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        {/* Image */}
        <div className="relative">
          <img
            src={fullResUrl(memory.photo_public_id)}
            alt={memory.caption}
            className="w-full max-h-[50vh] object-contain bg-gray-100"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 transition"
          >
            ✕
          </button>
          {/* Visibility badge */}
          <div className="absolute top-3 left-3">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              memory.visibility === 'public'
                ? 'bg-green-100 text-green-700'
                : memory.visibility === 'link'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {memory.visibility === 'public' ? '🌍 Public' : memory.visibility === 'link' ? '🔗 Link' : '🔒 Private'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {editing ? (
            <>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-gray-900"
              />
              <div className="flex gap-2">
                {(['private', 'public'] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                      visibility === v
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {v === 'private' ? '🔒 Private' : '🌍 Public'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition font-medium"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setCaption(memory.caption);
                    setVisibility(memory.visibility);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-900 text-lg">{memory.caption || 'No caption'}</p>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                {memory.taken_at && (
                  <span>📅 {new Date(memory.taken_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}</span>
                )}
                <span>📍 {memory.latitude.toFixed(4)}, {memory.longitude.toFixed(4)}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={async () => {
                    if (shareUrl) {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } else {
                      const result = await generateShareLink(memory.id);
                      if (result.token) {
                        const url = `${window.location.origin}/memory/share/${result.token}`;
                        setShareUrl(url);
                        await navigator.clipboard.writeText(url);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 text-blue-600 rounded-xl hover:bg-blue-50 transition font-medium"
                >
                  {copied ? '✓ Copied!' : '🔗 Share'}
                </button>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-4 py-2 bg-gray-100 text-red-600 rounded-xl hover:bg-red-50 transition"
                  >
                    🗑️
                  </button>
                ) : (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:bg-red-300 transition font-medium"
                  >
                    {saving ? '...' : 'Confirm delete'}
                  </button>
                )}
              </div>

              {shareUrl && (
                <div className="bg-blue-50 rounded-lg p-3 mt-2">
                  <p className="text-xs text-blue-600 break-all">{shareUrl}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
