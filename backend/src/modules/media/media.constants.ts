export const MEDIA_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 25_000_000,
  maxDimension: 10_000,
  displaySize: 1600,
  thumbnailSize: 320,
  uploadMinutes: 15,
  unreferencedHours: 24,
  processingTimeoutMinutes: 60,
  dailyUploads: 100,
  activeUploads: 20,
} as const;

export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
