import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST() {
  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const timestamp = Math.round(new Date().getTime() / 1000).toString();
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;

  const params: Record<string, string> = {
    timestamp,
    folder: 'lovemapper',
    // Enforce max file size and allowed formats on Cloudinary's end
    transformation: 'c_limit,w_4096,h_4096,q_auto',
  };

  // Generate signature
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  const signature = crypto
    .createHash('sha256')
    .update(sortedParams + apiSecret)
    .digest('hex');

  return NextResponse.json({
    signature,
    timestamp,
    apiKey,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    folder: 'lovemapper',
    transformation: params.transformation,
    maxFileSize: MAX_FILE_SIZE,
  });
}
