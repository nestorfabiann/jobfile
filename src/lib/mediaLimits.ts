/** Limits for photos and videos on a marketplace project. Safe for client and server. */
export const MAX_PHOTOS = 12;
export const MAX_VIDEOS = 2;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
