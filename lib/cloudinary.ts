// Cloudinary URL transform helpers
// All transforms are URL-based — no extra storage cost

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

/** 80x80 circle crop for map pins */
export function mapThumbnailUrl(publicId: string): string {
  return `${BASE}/c_fill,w_80,h_80,q_auto,f_auto/${publicId}`;
}

/** 400x300 card image for feed */
export function feedCardUrl(publicId: string): string {
  return `${BASE}/c_fill,w_400,h_300,q_auto,f_auto/${publicId}`;
}

/** Full resolution with auto quality/format */
export function fullResUrl(publicId: string): string {
  return `${BASE}/q_auto,f_auto/${publicId}`;
}

/** Generate Cloudinary upload signature (call from server only) */
export function generateSignature(params: Record<string, string>): string {
  // This will be used in the API route
  const crypto = require('crypto');
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha256')
    .update(sortedParams + apiSecret)
    .digest('hex');
}
