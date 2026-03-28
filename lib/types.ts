// Shared TypeScript types

export type Visibility = 'private' | 'public' | 'link';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  caption: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  photo_url: string;
  photo_public_id: string;
  visibility: Visibility;
  share_token: string | null;
  taken_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryWithProfile extends Memory {
  profiles: Profile;
}

// Upload form data
export interface UploadData {
  file: File;
  caption: string;
  latitude: number;
  longitude: number;
  visibility: Visibility;
  taken_at?: string;
}

// Map viewport bounds for bounding-box queries
export interface MapBounds {
  sw_lat: number;
  sw_lng: number;
  ne_lat: number;
  ne_lng: number;
}

// Search/filter params
export interface MemoryFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  bounds?: MapBounds;
}

// Cloudinary upload response (subset)
export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}
