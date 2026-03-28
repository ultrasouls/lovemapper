'use server';

import { createClient } from '@/lib/supabase/server';
import type { Memory, Visibility } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { rateLimit } from '@/lib/rate-limit';

const MAX_CAPTION_LENGTH = 2000;
const MAX_UPLOADS_PER_HOUR = 30;
const MAX_SHARES_PER_HOUR = 60;

export async function uploadMemory(data: {
  caption: string;
  latitude: number;
  longitude: number;
  visibility: Visibility;
  photoUrl: string;
  photoPublicId: string;
  takenAt?: string;
}): Promise<{ memory?: Memory; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Rate limit: 30 uploads per hour
  const { allowed } = rateLimit(`upload:${user.id}`, MAX_UPLOADS_PER_HOUR, 60 * 60 * 1000);
  if (!allowed) {
    return { error: 'Too many uploads. Please wait a bit.' };
  }

  // Validate inputs
  if (!data.photoUrl || !data.photoPublicId) {
    return { error: 'Missing photo data' };
  }
  if (data.caption.length > MAX_CAPTION_LENGTH) {
    return { error: `Caption must be under ${MAX_CAPTION_LENGTH} characters` };
  }
  if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180) {
    return { error: 'Invalid coordinates' };
  }

  const { data: memory, error } = await supabase
    .from('memories')
    .insert({
      user_id: user.id,
      caption: data.caption,
      latitude: data.latitude,
      longitude: data.longitude,
      visibility: data.visibility,
      photo_url: data.photoUrl,
      photo_public_id: data.photoPublicId,
      taken_at: data.takenAt || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Upload memory error:', error);
    return { error: error.message };
  }

  revalidatePath('/map');
  revalidatePath('/feed');
  revalidatePath('/explore');

  return { memory };
}

export async function updateMemory(data: {
  id: string;
  caption?: string;
  visibility?: Visibility;
  locationName?: string;
}): Promise<{ memory?: Memory; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const updates: Record<string, unknown> = {};
  if (data.caption !== undefined) updates.caption = data.caption;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.locationName !== undefined) updates.location_name = data.locationName;

  const { data: memory, error } = await supabase
    .from('memories')
    .update(updates)
    .eq('id', data.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/map');
  revalidatePath('/feed');

  return { memory };
}

export async function deleteMemory(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/map');
  revalidatePath('/feed');
  revalidatePath('/explore');

  return {};
}

export async function generateShareLink(id: string): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Rate limit: 60 shares per hour
  const { allowed } = rateLimit(`share:${user.id}`, MAX_SHARES_PER_HOUR, 60 * 60 * 1000);
  if (!allowed) {
    return { error: 'Too many share links. Please wait a bit.' };
  }

  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  const { error } = await supabase
    .from('memories')
    .update({ share_token: token, visibility: 'link' as Visibility })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/map');
  revalidatePath('/feed');

  return { token };
}

export async function revokeShareLink(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('memories')
    .update({ share_token: null, visibility: 'private' as Visibility })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/map');
  revalidatePath('/feed');

  return {};
}
