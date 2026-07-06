/**
 * MIME type utilities for media-gen-cli.
 */

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

export function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

export function getExtensionForMime(mimeType: string): string {
  for (const [ext, mime] of Object.entries(MIME_MAP)) {
    if (mime === mimeType) return ext;
  }
  return '.bin';
}

export function isImageFile(filePath: string): boolean {
  const mime = getMimeType(filePath);
  return mime.startsWith('image/');
}

export function isAudioFile(filePath: string): boolean {
  const mime = getMimeType(filePath);
  return mime.startsWith('audio/');
}

export function isVideoFile(filePath: string): boolean {
  const mime = getMimeType(filePath);
  return mime.startsWith('video/');
}
