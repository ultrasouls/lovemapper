// EXIF extraction wrapper using exifr
import exifr from 'exifr';

export interface ExifData {
  latitude: number | null;
  longitude: number | null;
  takenAt: Date | null;
}

/** Extract GPS coordinates and date from a photo file */
export async function extractExif(file: File): Promise<ExifData> {
  try {
    const exif = await exifr.parse(file, {
      gps: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude'],
    });

    if (!exif) {
      return { latitude: null, longitude: null, takenAt: null };
    }

    return {
      latitude: exif.latitude ?? null,
      longitude: exif.longitude ?? null,
      takenAt: exif.DateTimeOriginal ?? exif.CreateDate ?? null,
    };
  } catch {
    return { latitude: null, longitude: null, takenAt: null };
  }
}
