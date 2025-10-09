/**
 * Link health check types and constants
 */

export enum LinkStatus {
  OK = 'ok',
  NOT_FOUND = '404',
  FORBIDDEN = '403',
  TIMEOUT = 'timeout',
  INVALID_MIME = 'invalid_mime',
  DECODE_ERROR = 'decode_error',
  EXPIRED_PRESIGN = 'expired_presign',
  NETWORK_ERROR = 'network_error',
  PENDING = 'pending',
}

export interface LinkHealthJob {
  requestId: string;
  url: string;
  retryCount?: number;
}

export interface LinkHealthResult {
  requestId: string;
  url: string;
  linkStatus: LinkStatus;
  latencyMs: number;
  contentType?: string;
  contentLength?: number;
  headers?: Record<string, string>;
  errorMessage?: string;
}

export interface AssetRecord {
  id?: string;
  request_id: string;
  url: string;
  link_status: LinkStatus;
  latency_ms: number;
  content_type?: string;
  content_length?: number;
  headers?: Record<string, string>;
  error_message?: string;
  last_checked_at: Date;
}

// Request timeout in milliseconds
export const REQUEST_TIMEOUT_MS = 5000;

// Maximum request body size for image validation (10MB)
export const MAX_BODY_SIZE = 10 * 1024 * 1024;

// Valid image MIME types
export const VALID_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
];

// Retry configuration
export const RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // 1 second initial delay
  },
};
